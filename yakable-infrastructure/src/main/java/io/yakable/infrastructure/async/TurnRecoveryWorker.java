package io.yakable.infrastructure.async;

import io.yakable.application.session.TurnExecutionRecoveryService;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class TurnRecoveryWorker implements AutoCloseable {

    private static final System.Logger log = System.getLogger(
            TurnRecoveryWorker.class.getName()
    );

    private final ScheduledExecutorService scheduler;
    private final TurnExecutionRecoveryService recoveryService;
    private final Duration interval;
    private final boolean enabled;

    private ScheduledFuture<?> task;

    public TurnRecoveryWorker(
            ScheduledExecutorService scheduler,
            TurnExecutionRecoveryService recoveryService,
            Duration interval,
            boolean enabled
    ) {
        this.scheduler = Objects.requireNonNull(
                scheduler,
                "scheduler"
        );
        this.recoveryService = Objects.requireNonNull(
                recoveryService,
                "recoveryService"
        );
        this.interval = requirePositive(interval, "interval");
        this.enabled = enabled;
    }

    public synchronized void start() {
        if (!enabled || task != null) {
            return;
        }

        long delayMillis = Math.max(1L, interval.toMillis());
        task = scheduler.scheduleWithFixedDelay(
                this::runSafely,
                0L,
                delayMillis,
                TimeUnit.MILLISECONDS
        );
    }

    public void runOnce() {
        TurnExecutionRecoveryService.TurnRecoveryResult result =
                recoveryService.recoverAndDispatch(Instant.now());

        if (result.recoveredRunningTurns() > 0) {
            log.log(
                    System.Logger.Level.WARNING,
                    "Recovered stale RUNNING turns: "
                            + result.recoveredRunningTurns()
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

    private static Duration requirePositive(
            Duration value,
            String field
    ) {
        Objects.requireNonNull(value, field);
        if (value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException(
                    field + " must be positive"
            );
        }
        return value;
    }
}
