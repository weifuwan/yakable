package io.yakable.service.turn;

import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.model.ModelClient;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class TurnExecutor {

    private static final String SYSTEM_PROMPT =
            "You are Yakable, a concise and accurate assistant.";

    private final SessionRepository repository;
    private final ModelClient modelClient;
    private final TransactionTemplate transactionTemplate;

    public TurnExecutor(
            SessionRepository repository,
            ModelClient modelClient,
            TransactionTemplate transactionTemplate
    ) {
        this.repository = Objects.requireNonNull(
                repository,
                "repository"
        );
        this.modelClient = Objects.requireNonNull(
                modelClient,
                "modelClient"
        );
        this.transactionTemplate = Objects.requireNonNull(
                transactionTemplate,
                "transactionTemplate"
        );
    }

    public boolean execute(String turnId) {
        TurnEntity snapshot = repository.findTurnById(turnId)
                .orElse(null);
        if (snapshot == null) {
            return false;
        }

        SessionEntity session = repository
                .findSessionById(snapshot.getSessionId())
                .orElseThrow(() -> new IllegalStateException(
                        "Session does not exist: "
                                + snapshot.getSessionId()
                ));

        TurnEntity running = repository.claimPendingTurn(
                turnId,
                Instant.now(),
                session.getProvider(),
                session.getModel()
        ).orElse(null);

        if (running == null) {
            return false;
        }

        try {
            ModelClient.Reply reply = modelClient.chat(
                    session.getProvider(),
                    session.getModel(),
                    SYSTEM_PROMPT,
                    buildContext(
                            session.getId(),
                            running.getId()
                    )
            );
            persistSuccess(session, running, reply);
            return true;
        } catch (RuntimeException exception) {
            persistFailure(session, running, exception);
            throw exception;
        }
    }

    private List<ModelClient.Message> buildContext(
            String sessionId,
            String currentTurnId
    ) {
        Map<String, TurnEntity> turns = repository
                .findTurnsBySessionId(sessionId)
                .stream()
                .collect(Collectors.toMap(
                        TurnEntity::getId,
                        Function.identity()
                ));

        return repository.findMessagesBySessionId(sessionId)
                .stream()
                .filter(message -> {
                    if (currentTurnId.equals(message.getTurnId())) {
                        return true;
                    }
                    TurnEntity turn = turns.get(message.getTurnId());
                    return turn != null
                            && "SUCCEEDED".equals(turn.getStatus());
                })
                .map(TurnExecutor::toModelMessage)
                .toList();
    }

    private void persistSuccess(
            SessionEntity session,
            TurnEntity running,
            ModelClient.Reply reply
    ) {
        Instant completedAt = Instant.now();
        ModelClient.Usage usage = reply.usage();

        transactionTemplate.executeWithoutResult(status -> {
            int updated = repository.completeRunningTurn(
                    running.getId(),
                    running.getSessionId(),
                    reply.provider(),
                    reply.model(),
                    usage == null ? null : usage.inputTokens(),
                    usage == null ? null : usage.outputTokens(),
                    usage == null ? null : usage.totalTokens(),
                    reply.providerRequestId(),
                    reply.finishReason(),
                    completedAt
            );
            if (updated != 1) {
                throw new IllegalStateException(
                        "Turn is no longer RUNNING: "
                                + running.getId()
                );
            }

            MessageEntity message = new MessageEntity();
            message.setId(UUID.randomUUID().toString());
            message.setSessionId(running.getSessionId());
            message.setTurnId(running.getId());
            message.setRole("ASSISTANT");
            message.setContent(reply.content());
            message.setMessageSequence(
                    repository.nextMessageSequence(
                            running.getSessionId()
                    )
            );
            message.setCreatedAt(completedAt);
            repository.insertMessage(message);

            session.setUpdatedAt(completedAt);
            repository.saveSession(session);
        });
    }

    private void persistFailure(
            SessionEntity session,
            TurnEntity running,
            RuntimeException originalFailure
    ) {
        Instant failedAt = Instant.now();

        try {
            transactionTemplate.executeWithoutResult(status -> {
                repository.failRunningTurn(
                        running.getId(),
                        running.getSessionId(),
                        failureMessage(originalFailure),
                        failedAt
                );
                session.setUpdatedAt(failedAt);
                repository.saveSession(session);
            });
        } catch (RuntimeException persistenceFailure) {
            originalFailure.addSuppressed(persistenceFailure);
        }
    }

    private static ModelClient.Message toModelMessage(
            MessageEntity message
    ) {
        ModelClient.Role role = "USER".equals(message.getRole())
                ? ModelClient.Role.USER
                : ModelClient.Role.ASSISTANT;
        return new ModelClient.Message(role, message.getContent());
    }

    private static String failureMessage(
            RuntimeException exception
    ) {
        String message = exception.getMessage();
        return message == null || message.isBlank()
                ? exception.getClass().getSimpleName()
                : message.strip();
    }
}
