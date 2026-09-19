package io.yakable.core.session;

import io.yakable.core.model.ModelRuntime;
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

public final class TurnExecutor {

    private final SessionRepository sessionRepository;
    private final SessionExecutionRepository executionRepository;
    private final ModelRuntime modelRuntime;
    private final TurnPromptAssembler promptAssembler;

    public TurnExecutor(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository,
            ModelRuntime modelRuntime,
            TurnPromptAssembler promptAssembler
    ) {
        this.sessionRepository = Objects.requireNonNull(
                sessionRepository,
                "sessionRepository"
        );
        this.executionRepository = Objects.requireNonNull(
                executionRepository,
                "executionRepository"
        );
        this.modelRuntime = Objects.requireNonNull(
                modelRuntime,
                "modelRuntime"
        );
        this.promptAssembler = Objects.requireNonNull(
                promptAssembler,
                "promptAssembler"
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

        Instant completedAt;
        try {
            List<SessionMessage> context = buildModelContext(
                    session.id(),
                    runningTurn.id()
            );
            LlmRequest request = promptAssembler.assemble(
                    session,
                    context
            );

            LlmResponse response = modelRuntime.chat(
                    session.provider(),
                    request
            );

            completedAt = Instant.now();
            executionRepository.completeTurn(
                    runningTurn,
                    UUID.randomUUID().toString(),
                    response.content(),
                    completedAt
            );
        } catch (RuntimeException exception) {
            Instant failedAt = Instant.now();
            executionRepository.failTurn(
                    runningTurn,
                    failureMessage(exception),
                    failedAt
            );
            sessionRepository.save(session.touch(failedAt));
            throw exception;
        }

        sessionRepository.save(session.touch(completedAt));
        return true;
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
