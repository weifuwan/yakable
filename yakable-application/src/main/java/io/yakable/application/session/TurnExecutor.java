package io.yakable.application.session;

import io.yakable.application.context.ContextBundle;
import io.yakable.application.context.ContextPolicy;
import io.yakable.application.context.ModelInvocationCompiler;
import io.yakable.application.model.ModelGateway;
import io.yakable.application.model.ModelReply;
import io.yakable.application.model.ModelRequest;
import io.yakable.application.model.ModelUsage;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionNotFoundException;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnTokenUsage;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class TurnExecutor {

    private final SessionRepository sessionRepository;
    private final SessionExecutionRepository executionRepository;
    private final ModelGateway modelGateway;
    private final ContextPolicy contextPolicy;
    private final ModelInvocationCompiler invocationCompiler;
    private final TransactionRunner transactionRunner;

    public TurnExecutor(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository,
            ModelGateway modelGateway,
            ContextPolicy contextPolicy,
            ModelInvocationCompiler invocationCompiler,
            TransactionRunner transactionRunner
    ) {
        this.sessionRepository = Objects.requireNonNull(
                sessionRepository,
                "sessionRepository"
        );
        this.executionRepository = Objects.requireNonNull(
                executionRepository,
                "executionRepository"
        );
        this.modelGateway = Objects.requireNonNull(
                modelGateway,
                "modelGateway"
        );
        this.contextPolicy = Objects.requireNonNull(
                contextPolicy,
                "contextPolicy"
        );
        this.invocationCompiler = Objects.requireNonNull(
                invocationCompiler,
                "invocationCompiler"
        );
        this.transactionRunner = Objects.requireNonNull(
                transactionRunner,
                "transactionRunner"
        );
    }

    public boolean execute(String turnId) {
        Turn snapshot = executionRepository
                .findTurnById(turnId)
                .orElse(null);

        if (snapshot == null) {
            return false;
        }

        Session session = sessionRepository
                .findById(snapshot.sessionId())
                .orElseThrow(() -> new SessionNotFoundException(
                        snapshot.sessionId()
                ));

        Turn runningTurn = executionRepository
                .claimPendingTurn(
                        turnId,
                        Instant.now(),
                        session.provider(),
                        session.model()
                )
                .orElse(null);

        if (runningTurn == null) {
            return false;
        }

        try {
            ContextBundle context = contextPolicy.resolve(
                    session,
                    runningTurn,
                    executionRepository.findTurnsBySessionId(
                            session.id()
                    ),
                    executionRepository.findMessagesBySessionId(
                            session.id()
                    )
            );
            ModelRequest request = invocationCompiler.compile(
                    session,
                    context
            );
            ModelReply response = modelGateway.chat(
                    session.provider(),
                    request
            );

            persistSuccess(
                    session,
                    runningTurn,
                    response
            );
            return true;
        } catch (RuntimeException exception) {
            persistFailureBestEffort(
                    session,
                    runningTurn,
                    exception
            );
            throw exception;
        }
    }

    private void persistSuccess(
            Session session,
            Turn runningTurn,
            ModelReply response
    ) {
        Instant completedAt = Instant.now();
        TurnInvocation completedInvocation =
                Objects.requireNonNull(
                        runningTurn.invocation(),
                        "runningTurn.invocation"
                ).completed(
                        response.provider(),
                        response.model(),
                        toTurnTokenUsage(response.usage()),
                        response.providerRequestId(),
                        response.finishReason()
                );

        transactionRunner.required(() -> {
            executionRepository.completeTurn(
                    runningTurn,
                    UUID.randomUUID().toString(),
                    response.content(),
                    completedInvocation,
                    completedAt
            );
            sessionRepository.save(
                    session.touch(completedAt)
            );
            return Boolean.TRUE;
        });
    }

    private void persistFailureBestEffort(
            Session session,
            Turn runningTurn,
            RuntimeException originalFailure
    ) {
        Instant failedAt = Instant.now();

        try {
            transactionRunner.required(() -> {
                executionRepository.failTurn(
                        runningTurn,
                        failureMessage(originalFailure),
                        failedAt
                );
                sessionRepository.save(
                        session.touch(failedAt)
                );
                return Boolean.TRUE;
            });
        } catch (RuntimeException persistenceFailure) {
            originalFailure.addSuppressed(persistenceFailure);
        }
    }

    private static TurnTokenUsage toTurnTokenUsage(
            ModelUsage usage
    ) {
        TurnTokenUsage tokenUsage = new TurnTokenUsage(
                usage.inputTokens(),
                usage.outputTokens(),
                usage.totalTokens()
        );
        return tokenUsage.empty() ? null : tokenUsage;
    }

    private static String failureMessage(
            RuntimeException exception
    ) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.strip();
    }
}
