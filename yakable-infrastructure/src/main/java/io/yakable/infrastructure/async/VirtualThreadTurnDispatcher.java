package io.yakable.infrastructure.async;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.session.TurnExecutor;

import java.util.Objects;
import java.util.concurrent.Executor;

public final class VirtualThreadTurnDispatcher
        implements TurnDispatcher {

    private static final System.Logger log = System.getLogger(
            VirtualThreadTurnDispatcher.class.getName()
    );

    private final Executor executor;
    private final TurnExecutor turnExecutor;

    public VirtualThreadTurnDispatcher(
            Executor executor,
            TurnExecutor turnExecutor
    ) {
        this.executor = Objects.requireNonNull(executor, "executor");
        this.turnExecutor = Objects.requireNonNull(
                turnExecutor,
                "turnExecutor"
        );
    }

    @Override
    public void dispatch(String turnId) {
        executor.execute(() -> {
            try {
                boolean claimed = turnExecutor.execute(turnId);
                if (!claimed) {
                    log.log(
                            System.Logger.Level.DEBUG,
                            "Session turn was already claimed or completed: "
                                    + turnId
                    );
                }
            } catch (RuntimeException exception) {
                log.log(
                        System.Logger.Level.WARNING,
                        "Session turn execution failed: " + turnId,
                        exception
                );
            }
        });
    }
}
