package io.yakable.core.session;

import io.yakable.core.model.ModelRuntime;
import io.yakable.plugin.model.api.LlmMessage;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class SessionService {

    private static final String SYSTEM_PROMPT =
            "You are Yakable, a concise and accurate assistant.";

    private final SessionRepository sessionRepository;
    private final TurnRepository turnRepository;
    private final SessionMessageRepository messageRepository;
    private final ModelRuntime modelRuntime;

    public SessionService(
            SessionRepository sessionRepository,
            TurnRepository turnRepository,
            SessionMessageRepository messageRepository,
            ModelRuntime modelRuntime
    ) {
        this.sessionRepository = Objects.requireNonNull(sessionRepository, "sessionRepository");
        this.turnRepository = Objects.requireNonNull(turnRepository, "turnRepository");
        this.messageRepository = Objects.requireNonNull(messageRepository, "messageRepository");
        this.modelRuntime = Objects.requireNonNull(modelRuntime, "modelRuntime");
    }

    public Session createSession(
            String projectId,
            String title,
            String provider,
            String model
    ) {
        Instant now = Instant.now();
        Session session = new Session(
                UUID.randomUUID().toString(),
                projectId,
                title,
                provider,
                model,
                SessionStatus.ACTIVE,
                now,
                now
        );
        return sessionRepository.save(session);
    }

    public TurnStartResult startTurn(String sessionId, String content) {
        String normalizedContent = requireText(content, "content");
        Session session = requireSession(sessionId);
        if (session.status() != SessionStatus.ACTIVE) {
            throw new IllegalStateException("Session is not active: " + sessionId);
        }

        boolean hasActiveTurn = turnRepository.findBySessionId(sessionId).stream()
                .anyMatch(turn -> turn.status().active());
        if (hasActiveTurn) {
            throw new IllegalStateException(
                    "Session already has an active turn: " + sessionId
            );
        }

        Instant now = Instant.now();
        Turn turn = turnRepository.save(new Turn(
                UUID.randomUUID().toString(),
                sessionId,
                TurnStatus.PENDING,
                null,
                now,
                now
        ));

        SessionMessage userMessage = appendMessage(
                turn,
                SessionMessage.Role.USER,
                normalizedContent
        );

        sessionRepository.save(session.touch(now));
        return new TurnStartResult(turn, userMessage);
    }

    public void executeTurn(String turnId) {
        Turn pendingTurn = requireTurn(turnId);
        if (pendingTurn.status() != TurnStatus.PENDING) {
            throw new IllegalStateException(
                    "Turn is not pending: " + pendingTurn.id()
            );
        }

        Session session = requireSession(pendingTurn.sessionId());
        Turn runningTurn = turnRepository.save(
                pendingTurn.markRunning(Instant.now())
        );

        try {
            List<LlmMessage> history = buildModelHistory(
                    session.id(),
                    runningTurn.id()
            );

            LlmResponse response = modelRuntime.chat(
                    session.provider(),
                    new LlmRequest(
                            session.model(),
                            SYSTEM_PROMPT,
                            history
                    )
            );

            appendMessage(
                    runningTurn,
                    SessionMessage.Role.ASSISTANT,
                    response.content()
            );

            Instant completedAt = Instant.now();
            turnRepository.save(runningTurn.markSucceeded(completedAt));
            sessionRepository.save(session.touch(completedAt));
        } catch (RuntimeException exception) {
            Instant failedAt = Instant.now();
            turnRepository.save(
                    runningTurn.markFailed(failureMessage(exception), failedAt)
            );
            sessionRepository.save(session.touch(failedAt));
            throw exception;
        }
    }

    public SessionSnapshot getSnapshot(String sessionId) {
        Session session = requireSession(sessionId);
        List<Turn> turns = turnRepository.findBySessionId(sessionId).stream()
                .sorted(Comparator.comparing(Turn::createdAt))
                .toList();
        List<SessionMessage> messages =
                messageRepository.findBySessionId(sessionId).stream()
                        .sorted(Comparator.comparingLong(SessionMessage::sequence))
                        .toList();

        return new SessionSnapshot(session, turns, messages);
    }

    public List<Session> listProjectSessions(String projectId) {
        Objects.requireNonNull(projectId, "projectId");
        return sessionRepository.findByProjectId(projectId).stream()
                .sorted(Comparator.comparing(Session::updatedAt).reversed())
                .toList();
    }

    private List<LlmMessage> buildModelHistory(
            String sessionId,
            String currentTurnId
    ) {
        Map<String, Turn> turnsById =
                turnRepository.findBySessionId(sessionId).stream()
                        .collect(Collectors.toMap(
                                Turn::id,
                                Function.identity()
                        ));

        return messageRepository.findBySessionId(sessionId).stream()
                .sorted(Comparator.comparingLong(SessionMessage::sequence))
                .filter(message -> {
                    if (message.turnId().equals(currentTurnId)) {
                        return true;
                    }
                    Turn turn = turnsById.get(message.turnId());
                    return turn != null && turn.status() == TurnStatus.SUCCEEDED;
                })
                .map(SessionService::toLlmMessage)
                .toList();
    }

    private SessionMessage appendMessage(
            Turn turn,
            SessionMessage.Role role,
            String content
    ) {
        SessionMessage message = new SessionMessage(
                UUID.randomUUID().toString(),
                turn.sessionId(),
                turn.id(),
                role,
                content,
                messageRepository.nextSequence(turn.sessionId()),
                Instant.now()
        );
        return messageRepository.save(message);
    }

    private Session requireSession(String sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
    }

    private Turn requireTurn(String turnId) {
        return turnRepository.findById(turnId)
                .orElseThrow(() -> new TurnNotFoundException(turnId));
    }

    private static LlmMessage toLlmMessage(SessionMessage message) {
        LlmMessage.Role role = switch (message.role()) {
            case USER -> LlmMessage.Role.USER;
            case ASSISTANT -> LlmMessage.Role.ASSISTANT;
        };
        return new LlmMessage(role, message.content());
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return normalized;
    }

    private static String failureMessage(RuntimeException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.strip();
    }
}
