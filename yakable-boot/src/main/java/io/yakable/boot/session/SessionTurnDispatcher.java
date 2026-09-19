package io.yakable.boot.session;

import io.yakable.core.session.SessionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;
import java.util.concurrent.Executor;

public final class SessionTurnDispatcher {

    private static final Logger log =
            LoggerFactory.getLogger(SessionTurnDispatcher.class);

    private final Executor executor;
    private final SessionService sessionService;

    public SessionTurnDispatcher(
            Executor executor,
            SessionService sessionService
    ) {
        this.executor = Objects.requireNonNull(executor, "executor");
        this.sessionService = Objects.requireNonNull(
                sessionService,
                "sessionService"
        );
    }

    public void dispatch(String turnId) {
        executor.execute(() -> {
            try {
                sessionService.executeTurn(turnId);
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
