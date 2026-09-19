package io.yakable.application.session;

import io.yakable.application.model.ModelGateway;
import io.yakable.application.model.ModelReply;
import io.yakable.application.model.ModelRequest;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionNotFoundException;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnStatus;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class TurnExecutor {

    private final SessionRepository sessionRepository;
    private final SessionExecutionRepository executionRepository;
    private final ModelGateway modelGateway;
    private final TurnPromptAssembler promptAssembler;
    private final TransactionRunner transactionRunner;

    public TurnExecutor(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository,
            ModelGateway modelGateway,
            TurnPromptAssembler promptAssembler,
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
        this.promptAssembler = Objects.requireNonNull(
                promptAssembler,
                "promptAssembler"
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
                .claimPendingTurn(turnId, Instant.now())
                .orElse(null);

        if (runningTurn == null) {
            return false;
        }

        List<SessionMessage> context = buildModelContext(
                session.id(),
                runningTurn.id()
        );
        ModelRequest request = promptAssembler.assemble(
                session,
                context
        );

        ModelReply response;
        try {
            response = modelGateway.chat(
                    session.provider(),
                    request
            );
        } catch (RuntimeException exception) {
            persistFailure(
                    session,
                    runningTurn,
                    exception
            );
            throw exception;
        }

        persistSuccess(
                session,
                runningTurn,
                response
        );
        return true;
    }

    private void persistSuccess(
            Session session,
            Turn runningTurn,
            ModelReply response
    ) {
        Instant completedAt = Instant.now();

        transactionRunner.required(() -> {
            executionRepository.completeTurn(
                    runningTurn,
                    UUID.randomUUID().toString(),
                    response.content(),
                    completedAt
            );
            sessionRepository.save(
                    session.touch(completedAt)
            );
            return Boolean.TRUE;
        });
    }

    private void persistFailure(
            Session session,
            Turn runningTurn,
            RuntimeException exception
    ) {
        Instant failedAt = Instant.now();

        transactionRunner.required(() -> {
            executionRepository.failTurn(
                    runningTurn,
                    failureMessage(exception),
                    failedAt
            );
            sessionRepository.save(
                    session.touch(failedAt)
            );
            return Boolean.TRUE;
        });
    }

    private List<SessionMessage> buildModelContext(
            String sessionId,
            String currentTurnId
    ) {
        Map<String, Turn> turnsById = executionRepository
                .findTurnsBySessionId(sessionId)
                .stream()
                .collect(Collectors.toMap(
                        Turn::id,
                        Function.identity()
                ));

        return executionRepository
                .findMessagesBySessionId(sessionId)
                .stream()
                .sorted(Comparator.comparingLong(SessionMessage::sequence))
                .filter(message -> {
                    if (message.turnId().equals(currentTurnId)) {
                        return true;
                    }

                    Turn turn = turnsById.get(message.turnId());
                    return turn != null
                            && turn.status() == TurnStatus.SUCCEEDED;
                })
                .toList();
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
