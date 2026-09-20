package io.yakable.service.session;

import io.yakable.common.enums.MessageRoleEnum;
import io.yakable.common.enums.SessionStatusEnum;
import io.yakable.common.enums.TurnStatusEnum;
import io.yakable.common.utils.DateUtils;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.turn.TurnDispatcher;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class SessionService {

    private static final int MAX_MESSAGE_PAGE_SIZE = 100;

    private final SessionRepository repository;
    private final TurnDispatcher turnDispatcher;
    private final TransactionTemplate transactionTemplate;

    public SessionService(SessionRepository repository, TurnDispatcher turnDispatcher, TransactionTemplate transactionTemplate) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.turnDispatcher = Objects.requireNonNull(turnDispatcher, "turnDispatcher");
        this.transactionTemplate = Objects.requireNonNull(transactionTemplate, "transactionTemplate");
    }

    public InitialSession createInitialSession(
            String projectId, String title, String provider, String model, String content) {
        SessionEntity session = new SessionEntity();
        session.initCreate();
        session.setProjectId(requireText(projectId, "projectId"));
        session.setTitle(requireText(title, "title"));
        session.setProvider(requireText(provider, "provider"));
        session.setModel(requireText(model, "model"));
        session.setStatus(SessionStatusEnum.ACTIVE.getValue());
        repository.saveSession(session);

        TurnStart turn = createPendingTurn(session, requireText(content, "content"));
        return new InitialSession(session.getId(), session.getUpdateTime(), turn.turn().id());
    }

    public TurnStart startTurn(String projectId, String sessionId, String content) {
        TurnStart result = transactionTemplate.execute(status -> {
            SessionEntity session = requireOwnedSession(projectId, sessionId);
            if (!SessionStatusEnum.ACTIVE.getValue().equals(session.getStatus())) {
                throw new SessionInactiveException(sessionId);
            }
            return createPendingTurn(session, requireText(content, "content"));
        });

        if (result == null) {
            throw new IllegalStateException("Turn transaction returned no result");
        }

        turnDispatcher.dispatch(result.turn().id());
        return result;
    }

    public SessionSnapshot getSnapshot(String projectId, String sessionId) {
        SessionEntity session = requireOwnedSession(projectId, sessionId);
        return new SessionSnapshot(
                toSessionView(session),
                repository.findTurnsBySessionId(sessionId).stream().map(SessionService::toTurnView).toList(),
                repository.findMessagesBySessionId(sessionId).stream().map(SessionService::toMessageView).toList());
    }

    public SessionChanges getChanges(String projectId, String sessionId, long afterSequence) {
        if (afterSequence < 0) {
            throw new IllegalArgumentException("afterSequence must not be negative");
        }

        requireOwnedSession(projectId, sessionId);
        TurnEntity latest = repository.findLatestTurn(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));

        return new SessionChanges(
                toTurnView(latest),
                repository.findMessagesAfter(sessionId, afterSequence).stream().map(SessionService::toMessageView).toList(),
                repository.latestMessageSequence(sessionId));
    }

    public MessagePage getMessagePage(String projectId, String sessionId, Long beforeSequence, int limit) {
        if (beforeSequence != null && beforeSequence <= 0) {
            throw new IllegalArgumentException("beforeSequence must be positive");
        }
        if (limit <= 0 || limit > MAX_MESSAGE_PAGE_SIZE) {
            throw new IllegalArgumentException("limit must be between 1 and " + MAX_MESSAGE_PAGE_SIZE);
        }

        requireOwnedSession(projectId, sessionId);
        List<MessageEntity> rows = repository.findMessagesBefore(sessionId, beforeSequence, limit + 1);
        boolean hasMore = rows.size() > limit;
        List<MessageEntity> pageRows = hasMore ? rows.subList(0, limit) : rows;

        List<MessageView> messages = new ArrayList<>(pageRows.stream().map(SessionService::toMessageView).toList());
        Collections.reverse(messages);

        Long nextBeforeSequence = hasMore && !messages.isEmpty() ? messages.get(0).sequence() : null;
        return new MessagePage(messages, nextBeforeSequence, hasMore);
    }

    private TurnStart createPendingTurn(SessionEntity session, String content) {
        if (!repository.lockSession(session.getId())) {
            throw new SessionNotFoundException(session.getId());
        }
        if (repository.countActiveTurns(session.getId()) > 0) {
            throw new SessionBusyException(session.getId());
        }

        TurnEntity turn = new TurnEntity();
        turn.initCreate();
        turn.setSessionId(session.getId());
        turn.setStatus(TurnStatusEnum.PENDING.getValue());
        turn.setAttemptCount(0);
        repository.insertTurn(turn);

        MessageEntity message = new MessageEntity();
        message.initCreate();
        message.setSessionId(session.getId());
        message.setTurnId(turn.getId());
        message.setRole(MessageRoleEnum.USER.getValue());
        message.setContent(content);
        message.setMessageSequence(repository.nextMessageSequence(session.getId()));
        repository.insertMessage(message);

        session.initUpdate();
        repository.saveSession(session);
        return new TurnStart(toTurnView(turn), toMessageView(message));
    }

    private SessionEntity requireOwnedSession(String projectId, String sessionId) {
        String normalizedProjectId = requireText(projectId, "projectId");
        String normalizedSessionId = requireText(sessionId, "sessionId");
        return repository.findOwnedSession(normalizedProjectId, normalizedSessionId)
                .orElseThrow(() -> new SessionNotFoundException(normalizedSessionId));
    }

    private static SessionView toSessionView(SessionEntity entity) {
        return new SessionView(
                entity.getId(),
                entity.getProjectId(),
                entity.getTitle(),
                new ModelView(entity.getProvider(), entity.getModel()),
                SessionStatusEnum.fromValue(entity.getStatus()).name(),
                entity.getCreateTime(),
                entity.getUpdateTime());
    }

    private static TurnView toTurnView(TurnEntity entity) {
        return new TurnView(
                entity.getId(),
                TurnStatusEnum.fromValue(entity.getStatus()).name(),
                entity.getAttemptCount() == null ? 0 : entity.getAttemptCount(),
                entity.getErrorMessage(),
                toInvocationView(entity),
                entity.getStartedAt(),
                entity.getFinishedAt(),
                durationMillis(entity),
                entity.getCreateTime(),
                entity.getUpdateTime());
    }

    private static InvocationView toInvocationView(TurnEntity entity) {
        if (entity.getProvider() == null && entity.getModel() == null) {
            return null;
        }

        TokenUsageView usage = entity.getInputTokens() == null
                && entity.getOutputTokens() == null
                && entity.getTotalTokens() == null
                ? null
                : new TokenUsageView(entity.getInputTokens(), entity.getOutputTokens(), entity.getTotalTokens());

        return new InvocationView(
                entity.getProvider(),
                entity.getModel(),
                usage,
                entity.getProviderRequestId(),
                entity.getFinishReason());
    }

    private static MessageView toMessageView(MessageEntity entity) {
        return new MessageView(
                entity.getId(),
                entity.getTurnId(),
                MessageRoleEnum.fromValue(entity.getRole()).name(),
                entity.getContent(),
                entity.getMessageSequence(),
                entity.getCreateTime());
    }

    private static Long durationMillis(TurnEntity entity) {
        if (entity.getStartedAt() == null || entity.getFinishedAt() == null) {
            return null;
        }
        return Duration.between(entity.getStartedAt(), entity.getFinishedAt()).toMillis();
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return normalized;
    }

    public record InitialSession(String sessionId, LocalDateTime updatedAt, String turnId) {
    }

    public record SessionSnapshot(SessionView session, List<TurnView> turns, List<MessageView> messages) {
    }

    public record SessionChanges(TurnView latestTurn, List<MessageView> messages, long latestSequence) {
    }

    public record MessagePage(List<MessageView> messages, Long nextBeforeSequence, boolean hasMore) {
    }

    public record SessionView(
            String id, String projectId, String title, ModelView model, String status,
            LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record ModelView(String provider, String model) {
    }

    public record TurnView(
            String id, String status, int attemptCount, String errorMessage, InvocationView invocation,
            LocalDateTime startedAt, LocalDateTime finishedAt, Long durationMs,
            LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record InvocationView(
            String provider, String model, TokenUsageView usage, String providerRequestId, String finishReason) {
    }

    public record TokenUsageView(Long inputTokens, Long outputTokens, Long totalTokens) {
    }

    public record MessageView(
            String id, String turnId, String role, String content, long sequence, LocalDateTime createdAt) {
    }

    public record TurnStart(TurnView turn, MessageView userMessage) {
    }

    public static class SessionNotFoundException extends RuntimeException {
        public SessionNotFoundException(String sessionId) {
            super("Session not found: " + sessionId);
        }
    }

    public static class SessionBusyException extends RuntimeException {
        public SessionBusyException(String sessionId) {
            super("Session already has an active turn: " + sessionId);
        }
    }

    public static class SessionInactiveException extends RuntimeException {
        public SessionInactiveException(String sessionId) {
            super("Session is not active: " + sessionId);
        }
    }
}
