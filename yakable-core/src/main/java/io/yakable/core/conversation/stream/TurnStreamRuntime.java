package io.yakable.core.conversation.stream;

import io.yakable.common.constant.MessageConstant;
import io.yakable.common.utils.ThreadUtils;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Turn 流式输出的 JVM Runtime。
 *
 * <p>只负责内存中的 buffer、watcher、terminal 和 stop cutover，不负责 Turn 业务状态或持久化。</p>
 */
@Component
public class TurnStreamRuntime {

    private static final String WATCHER_DELIVERY_TASK_PREFIX = "turn-watcher-delivery-";
    private static final AtomicLong WATCHER_DELIVERY_SEQUENCE = new AtomicLong();

    private final Map<String, TurnStreamState> states = new ConcurrentHashMap<>();
    private final int maxContentLength;

    public TurnStreamRuntime() {
        this(MessageConstant.MAX_CONTENT_LENGTH);
    }

    TurnStreamRuntime(int maxContentLength) {
        if (maxContentLength <= 0) {
            throw new IllegalArgumentException("maxContentLength must be greater than zero");
        }
        this.maxContentLength = maxContentLength;
    }

    public void open(String turnId) {
        state(turnId);
    }

    public Runnable watch(String turnId, TurnStreamListener listener) {
        TurnStreamState state = state(turnId);
        state.add(listener);

        AtomicBoolean closed = new AtomicBoolean();
        return () -> {
            if (!closed.compareAndSet(false, true)) {
                return;
            }
            state.remove(listener);
            cleanup(turnId);
        };
    }

    public void delta(String turnId, String value) {
        state(turnId).delta(value);
    }

    public String snapshot(String turnId) {
        TurnStreamState state = states.get(turnId);
        return state == null ? "" : state.snapshot();
    }

    public Optional<String> beginStopCutover(String turnId) {
        TurnStreamState state = states.get(turnId);
        return state == null ? Optional.empty() : Optional.of(state.beginStopCutover());
    }

    public void cancelStopCutover(String turnId) {
        TurnStreamState state = states.get(turnId);
        if (state != null) {
            state.cancelStopCutover();
        }
    }

    public void complete(String turnId) {
        publishTerminal(turnId, new TerminalEvent(TerminalType.COMPLETE, null));
    }

    public void failed(String turnId, String message) {
        publishTerminal(turnId, new TerminalEvent(TerminalType.FAILED, message));
    }

    public void stopped(String turnId) {
        publishTerminal(turnId, new TerminalEvent(TerminalType.STOPPED, null));
    }

    public void cleanup(String turnId) {
        TurnStreamState state = states.get(turnId);
        if (state != null && state.isTerminal() && state.isEmpty()) {
            states.remove(turnId, state);
        }
    }

    private TurnStreamState state(String turnId) {
        return states.computeIfAbsent(turnId, ignored -> new TurnStreamState());
    }

    private void publishTerminal(String turnId, TerminalEvent event) {
        TurnStreamState state = states.get(turnId);
        if (state != null) {
            state.publishTerminal(event);
        }
    }

    private final class TurnStreamState {

        private final Object eventLock = new Object();
        private final StringBuilder content = new StringBuilder();
        private final List<WatcherSubscription> watchers = new ArrayList<>();
        private final AtomicReference<TerminalEvent> terminal = new AtomicReference<>();

        private int stopCutoverCount;

        void add(TurnStreamListener listener) {
            synchronized (eventLock) {
                WatcherSubscription watcher = new WatcherSubscription(listener);
                String snapshot = content.toString();
                TerminalEvent current = terminal.get();

                if (current == null) {
                    watchers.add(watcher);
                }
                if (!snapshot.isBlank() && !watcher.enqueueSnapshot(snapshot)) {
                    watchers.remove(watcher);
                    return;
                }
                if (current != null) {
                    watcher.enqueueTerminal(current);
                }
            }
        }

        void remove(TurnStreamListener listener) {
            WatcherSubscription removed = null;
            synchronized (eventLock) {
                for (WatcherSubscription watcher : watchers) {
                    if (watcher.matches(listener)) {
                        removed = watcher;
                        break;
                    }
                }
                if (removed != null) {
                    watchers.remove(removed);
                }
            }
            if (removed != null) {
                removed.close();
            }
        }

        void delta(String value) {
            synchronized (eventLock) {
                if (terminal.get() != null || stopCutoverCount > 0) {
                    return;
                }
                if ((long) content.length() + value.length() > maxContentLength) {
                    throw new BufferLimitExceededException(maxContentLength);
                }
                content.append(value);
                watchers.removeIf(watcher -> !watcher.enqueueDelta(value));
            }
        }

        String snapshot() {
            synchronized (eventLock) {
                return content.toString();
            }
        }

        String beginStopCutover() {
            synchronized (eventLock) {
                stopCutoverCount++;
                return content.toString();
            }
        }

        void cancelStopCutover() {
            synchronized (eventLock) {
                if (stopCutoverCount > 0) {
                    stopCutoverCount--;
                }
            }
        }

        boolean isTerminal() {
            synchronized (eventLock) {
                return terminal.get() != null;
            }
        }

        boolean isEmpty() {
            synchronized (eventLock) {
                return watchers.isEmpty();
            }
        }

        void publishTerminal(TerminalEvent event) {
            synchronized (eventLock) {
                if (!terminal.compareAndSet(null, event)) {
                    return;
                }
                watchers.removeIf(watcher -> !watcher.enqueueTerminal(event));
            }
        }
    }

    private static final class WatcherSubscription {

        private final Object deliveryLock = new Object();
        private final TurnStreamListener listener;
        private final String taskName =
                WATCHER_DELIVERY_TASK_PREFIX + WATCHER_DELIVERY_SEQUENCE.incrementAndGet();
        private final Deque<WatcherDelivery> pending = new ArrayDeque<>();

        private boolean draining;
        private boolean closed;
        private boolean terminalQueued;

        private WatcherSubscription(TurnStreamListener listener) {
            this.listener = listener;
        }

        boolean matches(TurnStreamListener candidate) {
            return listener == candidate;
        }

        boolean enqueueSnapshot(String value) {
            return enqueue(WatcherDelivery.snapshot(value));
        }

        boolean enqueueDelta(String value) {
            boolean schedule;
            synchronized (deliveryLock) {
                if (closed || terminalQueued) {
                    return false;
                }

                WatcherDelivery last = pending.peekLast();
                if (last != null && last.type() == DeliveryType.DELTA) {
                    last.append(value);
                } else {
                    pending.addLast(WatcherDelivery.delta(value));
                }
                schedule = markDraining();
            }
            return scheduleDrain(schedule);
        }

        boolean enqueueTerminal(TerminalEvent event) {
            boolean schedule;
            synchronized (deliveryLock) {
                if (closed || terminalQueued) {
                    return !closed;
                }
                terminalQueued = true;
                pending.addLast(WatcherDelivery.terminal(event));
                schedule = markDraining();
            }
            return scheduleDrain(schedule);
        }

        void close() {
            boolean cancel;
            synchronized (deliveryLock) {
                if (closed) {
                    return;
                }
                closed = true;
                pending.clear();
                cancel = draining;
            }
            if (cancel) {
                ThreadUtils.cancel(taskName);
            }
        }

        private boolean enqueue(WatcherDelivery delivery) {
            boolean schedule;
            synchronized (deliveryLock) {
                if (closed || terminalQueued) {
                    return false;
                }
                pending.addLast(delivery);
                schedule = markDraining();
            }
            return scheduleDrain(schedule);
        }

        private boolean markDraining() {
            if (draining) {
                return false;
            }
            draining = true;
            return true;
        }

        private boolean scheduleDrain(boolean schedule) {
            if (!schedule) {
                return true;
            }
            if (ThreadUtils.execute(taskName, this::drain)) {
                return true;
            }

            synchronized (deliveryLock) {
                closed = true;
                pending.clear();
                draining = false;
            }
            return false;
        }

        private void drain() {
            while (true) {
                WatcherDelivery delivery;
                synchronized (deliveryLock) {
                    if (closed) {
                        pending.clear();
                        draining = false;
                        return;
                    }
                    delivery = pending.pollFirst();
                    if (delivery == null) {
                        draining = false;
                        return;
                    }
                }
                deliver(delivery);
            }
        }

        private void deliver(WatcherDelivery delivery) {
            switch (delivery.type()) {
                case SNAPSHOT -> safeNotify(listener, item -> item.onSnapshot(delivery.content()));
                case DELTA -> safeNotify(listener, item -> item.onDelta(delivery.content()));
                case TERMINAL -> notifyTerminal(listener, delivery.terminal());
            }
        }

        private static void notifyTerminal(TurnStreamListener listener, TerminalEvent event) {
            switch (event.type()) {
                case COMPLETE -> safeNotify(listener, TurnStreamListener::onComplete);
                case FAILED -> safeNotify(listener, item -> item.onError(event.message()));
                case STOPPED -> safeNotify(listener, TurnStreamListener::onStopped);
            }
        }

        private static void safeNotify(
                TurnStreamListener listener, java.util.function.Consumer<TurnStreamListener> callback) {
            try {
                callback.accept(listener);
            } catch (RuntimeException ignored) {
                // 单个 Watcher 失败不能影响 Turn Runtime。
            }
        }
    }

    private static final class WatcherDelivery {

        private final DeliveryType type;
        private final StringBuilder content;
        private final TerminalEvent terminal;

        private WatcherDelivery(DeliveryType type, String content, TerminalEvent terminal) {
            this.type = type;
            this.content = content == null ? null : new StringBuilder(content);
            this.terminal = terminal;
        }

        static WatcherDelivery snapshot(String content) {
            return new WatcherDelivery(DeliveryType.SNAPSHOT, content, null);
        }

        static WatcherDelivery delta(String content) {
            return new WatcherDelivery(DeliveryType.DELTA, content, null);
        }

        static WatcherDelivery terminal(TerminalEvent event) {
            return new WatcherDelivery(DeliveryType.TERMINAL, null, event);
        }

        DeliveryType type() {
            return type;
        }

        String content() {
            return content == null ? "" : content.toString();
        }

        TerminalEvent terminal() {
            return terminal;
        }

        void append(String value) {
            if (content != null) {
                content.append(value);
            }
        }
    }

    private enum DeliveryType {
        SNAPSHOT,
        DELTA,
        TERMINAL
    }

    private record TerminalEvent(TerminalType type, String message) {
    }

    private enum TerminalType {
        COMPLETE,
        FAILED,
        STOPPED
    }

    public static final class BufferLimitExceededException extends RuntimeException {

        public BufferLimitExceededException(int maxContentLength) {
            super("Turn stream content exceeds max length: " + maxContentLength);
        }
    }
}
