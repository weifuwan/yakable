package io.yakable.core.conversation.stream;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TurnStreamRuntimeTest {

    @Test
    void shouldFreezePostCutoverDeltaAndPublishStopped() throws Exception {
        TurnStreamRuntime runtime = new TurnStreamRuntime(100);
        String turnId = "turn-cutover";
        CountDownLatch deltaDelivered = new CountDownLatch(1);
        CountDownLatch stoppedDelivered = new CountDownLatch(1);
        List<String> events = new CopyOnWriteArrayList<>();

        Runnable unsubscribe = runtime.watch(turnId, listener(
                content -> {
                    events.add("delta:" + content);
                    deltaDelivered.countDown();
                },
                () -> {
                    events.add("stopped");
                    stoppedDelivered.countDown();
                }));

        runtime.delta(turnId, "A");
        assertThat(deltaDelivered.await(2, TimeUnit.SECONDS)).isTrue();

        assertThat(runtime.beginStopCutover(turnId)).contains("A");
        runtime.delta(turnId, "B");
        assertThat(runtime.snapshot(turnId)).isEqualTo("A");

        runtime.stopped(turnId);
        assertThat(stoppedDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(events).containsExactly("delta:A", "stopped");

        unsubscribe.run();
    }

    @Test
    void shouldResumeDeltaAfterCutoverCancellation() throws Exception {
        TurnStreamRuntime runtime = new TurnStreamRuntime(100);
        String turnId = "turn-rollback";
        CountDownLatch firstDeltaDelivered = new CountDownLatch(1);
        CountDownLatch secondDeltaDelivered = new CountDownLatch(1);
        List<String> deltas = new CopyOnWriteArrayList<>();

        Runnable unsubscribe = runtime.watch(turnId, listener(
                content -> {
                    deltas.add(content);
                    if (deltas.size() == 1) {
                        firstDeltaDelivered.countDown();
                    } else if (deltas.size() == 2) {
                        secondDeltaDelivered.countDown();
                    }
                },
                () -> {
                }));

        runtime.delta(turnId, "A");
        assertThat(firstDeltaDelivered.await(2, TimeUnit.SECONDS)).isTrue();

        assertThat(runtime.beginStopCutover(turnId)).contains("A");
        runtime.cancelStopCutover(turnId);
        runtime.delta(turnId, "B");

        assertThat(secondDeltaDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(deltas).containsExactly("A", "B");
        assertThat(runtime.snapshot(turnId)).isEqualTo("AB");

        unsubscribe.run();
    }

    @Test
    void shouldIsolateSlowWatcherFromOtherWatchersAndTerminal() throws Exception {
        TurnStreamRuntime runtime = new TurnStreamRuntime(100);
        String turnId = "turn-isolation";
        CountDownLatch slowDeltaEntered = new CountDownLatch(1);
        CountDownLatch releaseSlowWatcher = new CountDownLatch(1);
        CountDownLatch slowStoppedDelivered = new CountDownLatch(1);
        CountDownLatch fastDeltaDelivered = new CountDownLatch(1);
        CountDownLatch fastStoppedDelivered = new CountDownLatch(1);

        TurnStreamListener slow = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
            }

            @Override
            public void onDelta(String content) {
                slowDeltaEntered.countDown();
                try {
                    releaseSlowWatcher.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
                slowStoppedDelivered.countDown();
            }
        };
        TurnStreamListener fast = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
            }

            @Override
            public void onDelta(String content) {
                fastDeltaDelivered.countDown();
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
                fastStoppedDelivered.countDown();
            }
        };

        Runnable unsubscribeSlow = runtime.watch(turnId, slow);
        Runnable unsubscribeFast = runtime.watch(turnId, fast);
        runtime.delta(turnId, "Partial");

        assertThat(slowDeltaEntered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(fastDeltaDelivered.await(2, TimeUnit.SECONDS)).isTrue();

        runtime.stopped(turnId);
        assertThat(fastStoppedDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(slowStoppedDelivered.getCount()).isEqualTo(1L);

        releaseSlowWatcher.countDown();
        assertThat(slowStoppedDelivered.await(2, TimeUnit.SECONDS)).isTrue();

        unsubscribeSlow.run();
        unsubscribeFast.run();
    }

    @Test
    void shouldRejectDeltaBeyondBufferBoundaryWithoutMutatingSnapshot() {
        TurnStreamRuntime runtime = new TurnStreamRuntime(3);
        String turnId = "turn-boundary";
        runtime.open(turnId);
        runtime.delta(turnId, "abc");

        assertThatThrownBy(() -> runtime.delta(turnId, "d"))
                .isInstanceOf(TurnStreamRuntime.BufferLimitExceededException.class);
        assertThat(runtime.snapshot(turnId)).isEqualTo("abc");
    }

    private static TurnStreamListener listener(
            java.util.function.Consumer<String> onDelta,
            Runnable onStopped) {
        return new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
            }

            @Override
            public void onDelta(String content) {
                onDelta.accept(content);
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
                onStopped.run();
            }
        };
    }
}
