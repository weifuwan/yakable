package io.yakable.service.turn;

import java.util.Objects;
import java.util.concurrent.Executor;

public final class TurnDispatcher {

    private static final System.Logger log = System.getLogger(
            TurnDispatcher.class.getName()
    );

    private final Executor executor;
    private final TurnExecutor turnExecutor;

    public TurnDispatcher(
            Executor executor,
            TurnExecutor turnExecutor
    ) {
        this.executor = Objects.requireNonNull(executor, "executor");
        this.turnExecutor = Objects.requireNonNull(
                turnExecutor,
                "turnExecutor"
        );
    }

    public boolean dispatch(String turnId) {
        try {
            executor.execute(() -> executeSafely(turnId));
            return true;
        } catch (RuntimeException exception) {
            log.log(
                    System.Logger.Level.WARNING,
                    "Turn dispatch rejected: " + turnId,
                    exception
            );
            return false;
        }
    }

    private void executeSafely(String turnId) {
        try {
            turnExecutor.execute(turnId);
        } catch (RuntimeException exception) {
            log.log(
                    System.Logger.Level.WARNING,
                    "Turn execution failed: " + turnId,
                    exception
            );
        }
    }
}
