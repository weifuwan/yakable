package io.yakable.boot.session;

import io.yakable.core.session.TurnExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;
import java.util.concurrent.Executor;

public final class SessionTurnDispatcher {

    private static final Logger log =
            LoggerFactory.getLogger(SessionTurnDispatcher.class);

    private final Executor executor;
    private final TurnExecutor turnExecutor;

    public SessionTurnDispatcher(
            Executor executor,
            TurnExecutor turnExecutor
    ) {
        this.executor = Objects.requireNonNull(executor, "executor");
        this.turnExecutor = Objects.requireNonNull(
                turnExecutor,
                "turnExecutor"
        );
    }

    public void dispatch(String turnId) {
        executor.execute(() -> {
            try {
                boolean claimed = turnExecutor.execute(turnId);
                if (!claimed) {
                    log.debug(
                            "Session turn was already claimed or completed: turnId={}",
                            turnId
                    );
                }
            } catch (RuntimeException exception) {
                log.warn(
                        "Session turn execution failed: turnId={}",
                        turnId,
                        exception
                );
            }
        });
    }
}
