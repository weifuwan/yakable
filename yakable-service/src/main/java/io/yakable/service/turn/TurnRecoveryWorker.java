package io.yakable.service.turn;

import io.yakable.common.utils.DateUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class TurnRecoveryWorker implements AutoCloseable {

    private static final System.Logger log = System.getLogger(
            TurnRecoveryWorker.class.getName()
    );

    private final ScheduledExecutorService scheduler;
    private final TurnService turnService;
    private final TurnDispatcher dispatcher;
    private final Duration interval;
    private final Duration runningTimeout;
    private final int batchSize;
    private final boolean enabled;

    private ScheduledFuture<?> task;

    public TurnRecoveryWorker(
            ScheduledExecutorService scheduler,
            TurnService turnService,
            TurnDispatcher dispatcher,
            Duration interval,
            Duration runningTimeout,
            int batchSize,
            boolean enabled
    ) {
        this.scheduler = Objects.requireNonNull(
                scheduler,
                "scheduler"
        );
        this.turnService = Objects.requireNonNull(
                turnService,
                "turnService"
        );
        this.dispatcher = Objects.requireNonNull(
                dispatcher,
                "dispatcher"
        );
        this.interval = Objects.requireNonNull(
                interval,
                "interval"
        );
        this.runningTimeout = Objects.requireNonNull(
                runningTimeout,
                "runningTimeout"
        );
        this.batchSize = batchSize;
        this.enabled = enabled;
    }

    public synchronized void start() {
        if (!enabled || task != null) {
            return;
        }

        task = scheduler.scheduleWithFixedDelay(
                this::runSafely,
                0L,
                Math.max(1L, interval.toMillis()),
                TimeUnit.MILLISECONDS
        );
    }

    public void runOnce() {
        LocalDateTime now = DateUtils.now();
        int recovered = turnService.updateStaleTurnPending(
                now.minus(runningTimeout),
                now
        );

        turnService.queryPendingTurnIdList(batchSize)
                .forEach(dispatcher::dispatch);

        if (recovered > 0) {
            log.log(
                    System.Logger.Level.WARNING,
                    "Recovered stale RUNNING turns: " + recovered
            );
        }
    }

    private void runSafely() {
        try {
            runOnce();
        } catch (RuntimeException exception) {
            log.log(
                    System.Logger.Level.WARNING,
                    "Turn recovery cycle failed",
                    exception
            );
        }
    }

    @Override
    public synchronized void close() {
        if (task != null) {
            task.cancel(false);
            task = null;
        }
    }
}
