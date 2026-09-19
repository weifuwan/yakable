package io.yakable.application.session;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.domain.session.TurnStartResult;

import java.util.Objects;

public final class SessionTurnService {

    private final SessionCommandService commandService;
    private final TurnDispatcher turnDispatcher;

    public SessionTurnService(
            SessionCommandService commandService,
            TurnDispatcher turnDispatcher
    ) {
        this.commandService = Objects.requireNonNull(
                commandService,
                "commandService"
        );
        this.turnDispatcher = Objects.requireNonNull(
                turnDispatcher,
                "turnDispatcher"
        );
    }

    public TurnStartResult startTurn(
            String projectId,
            String sessionId,
            String content
    ) {
        TurnStartResult result = commandService.startTurn(
                projectId,
                sessionId,
                content
        );
        turnDispatcher.dispatch(result.turn().id());
        return result;
    }
}
