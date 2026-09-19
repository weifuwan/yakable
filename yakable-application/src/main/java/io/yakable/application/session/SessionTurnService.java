package io.yakable.application.session;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.session.TurnStartResult;

import java.util.Objects;

public final class SessionTurnService {

    private final SessionCommandService commandService;
    private final TurnDispatcher turnDispatcher;
    private final TransactionRunner transactionRunner;

    public SessionTurnService(
            SessionCommandService commandService,
            TurnDispatcher turnDispatcher,
            TransactionRunner transactionRunner
    ) {
        this.commandService = Objects.requireNonNull(
                commandService,
                "commandService"
        );
        this.turnDispatcher = Objects.requireNonNull(
                turnDispatcher,
                "turnDispatcher"
        );
        this.transactionRunner = Objects.requireNonNull(
                transactionRunner,
                "transactionRunner"
        );
    }

    public TurnStartResult startTurn(
            String projectId,
            String sessionId,
            String content
    ) {
        TurnStartResult result = transactionRunner.required(
                () -> commandService.startTurn(
                        projectId,
                        sessionId,
                        content
                )
        );

        turnDispatcher.dispatch(result.turn().id());
        return result;
    }
}
