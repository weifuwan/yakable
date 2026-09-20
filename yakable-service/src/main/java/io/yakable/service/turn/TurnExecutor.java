package io.yakable.service.turn;

import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.utils.DateUtils;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.model.ModelClient;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class TurnExecutor {

    private static final String SYSTEM_PROMPT = "You are Yakable, a concise and accurate assistant.";

    private final SessionRepository repository;
    private final ModelClient modelClient;
    private final TransactionTemplate transactionTemplate;

    public TurnExecutor(SessionRepository repository, ModelClient modelClient, TransactionTemplate transactionTemplate) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.modelClient = Objects.requireNonNull(modelClient, "modelClient");
        this.transactionTemplate = Objects.requireNonNull(transactionTemplate, "transactionTemplate");
    }

    public boolean execute(String turnId) {
        TurnEntity snapshot = repository.queryTurn(turnId).orElse(null);
        if (snapshot == null) {
            return false;
        }

        SessionEntity session = repository.queryById(snapshot.getSessionId())
                .orElseThrow(() -> new IllegalStateException("Session does not exist: " + snapshot.getSessionId()));

        TurnEntity running = repository.updatePendingTurn(
                turnId, DateUtils.now(), session.getProvider(), session.getModel()).orElse(null);

        if (running == null) {
            return false;
        }

        try {
            ModelClient.Reply reply = modelClient.chat(
                    session.getProvider(),
                    session.getModel(),
                    SYSTEM_PROMPT,
                    buildContext(session.getId(), running.getId()));
            persistSuccess(session, running, reply);
            return true;
        } catch (RuntimeException exception) {
            persistFailure(session, running, exception);
            throw exception;
        }
    }

    private List<ModelClient.Message> buildContext(String sessionId, String currentTurnId) {
        Map<String, TurnEntity> turns = repository.queryTurnList(sessionId)
                .stream()
                .collect(Collectors.toMap(TurnEntity::getId, Function.identity()));

        return repository.queryMessageList(sessionId)
                .stream()
                .filter(message -> {
                    if (currentTurnId.equals(message.getTurnId())) {
                        return true;
                    }
                    TurnEntity turn = turns.get(message.getTurnId());
                    return turn != null && turn.getStatus() == TurnStatusEnum.SUCCEEDED;
                })
                .map(TurnExecutor::toModelMessage)
                .toList();
    }

    private void persistSuccess(SessionEntity session, TurnEntity running, ModelClient.Reply reply) {
        LocalDateTime completedAt = DateUtils.now();
        ModelClient.Usage usage = reply.usage();

        transactionTemplate.executeWithoutResult(status -> {
            int updated = repository.updateTurnSucceeded(
                    running.getId(),
                    running.getSessionId(),
                    reply.provider(),
                    reply.model(),
                    usage == null ? null : usage.inputTokens(),
                    usage == null ? null : usage.outputTokens(),
                    usage == null ? null : usage.totalTokens(),
                    reply.providerRequestId(),
                    reply.finishReason(),
                    completedAt);
            if (updated != 1) {
                throw new IllegalStateException("Turn is no longer RUNNING: " + running.getId());
            }

            MessageEntity message = new MessageEntity();
            message.initCreate();
            message.setSessionId(running.getSessionId());
            message.setTurnId(running.getId());
            message.setRole(MessageRoleEnum.ASSISTANT);
            message.setContent(reply.content());
            message.setMessageSequence(repository.queryNextMessageSequence(running.getSessionId()));
            repository.addMessage(message);

            session.initUpdate();
            repository.update(session);
        });
    }

    private void persistFailure(SessionEntity session, TurnEntity running, RuntimeException originalFailure) {
        LocalDateTime failedAt = DateUtils.now();

        try {
            transactionTemplate.executeWithoutResult(status -> {
                repository.updateTurnFailed(
                        running.getId(),
                        running.getSessionId(),
                        failureMessage(originalFailure),
                        failedAt);
                session.initUpdate();
                repository.update(session);
            });
        } catch (RuntimeException persistenceFailure) {
            originalFailure.addSuppressed(persistenceFailure);
        }
    }

    private static ModelClient.Message toModelMessage(MessageEntity message) {
        ModelClient.Role role = message.getRole() == MessageRoleEnum.USER
                ? ModelClient.Role.USER
                : ModelClient.Role.ASSISTANT;
        return new ModelClient.Message(role, message.getContent());
    }

    private static String failureMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message.strip();
    }
}
