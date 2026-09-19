package io.yakable.application.session;

import io.yakable.application.model.ModelGateway;
import io.yakable.application.model.ModelMessage;
import io.yakable.application.model.ModelReply;
import io.yakable.application.model.ModelRequest;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionBusyException;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionNotFoundException;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.domain.session.TurnStatus;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SessionFlowTest {

    @Test
    void successfulTurnsBuildContextFromSucceededHistory() {
        Fixture fixture = new Fixture();
        Session session = fixture.commandService.createSession(
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash"
        );

        TurnStartResult first = fixture.commandService.startTurn(
                "project-1",
                session.id(),
                "First question"
        );
        assertThat(fixture.turnExecutor.execute(first.turn().id()))
                .isTrue();

        TurnStartResult second = fixture.commandService.startTurn(
                "project-1",
                session.id(),
                "Second question"
        );
        assertThat(fixture.turnExecutor.execute(second.turn().id()))
                .isTrue();

        SessionSnapshot snapshot = fixture.queryService.getSnapshot(
                "project-1",
                session.id()
        );

        assertThat(snapshot.turns())
                .extracting(Turn::status)
                .containsExactly(
                        TurnStatus.SUCCEEDED,
                        TurnStatus.SUCCEEDED
                );
        assertThat(snapshot.messages())
                .extracting(SessionMessage::sequence)
                .containsExactly(1L, 2L, 3L, 4L);

        ModelRequest secondRequest =
                fixture.modelGateway.requests.get(1);
        assertThat(secondRequest.messages())
                .extracting(
                        ModelMessage::role,
                        ModelMessage::content
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                ModelMessage.Role.USER,
                                "First question"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                ModelMessage.Role.ASSISTANT,
                                "Assistant 1"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                ModelMessage.Role.USER,
                                "Second question"
                        )
                );
    }

    @Test
    void failedTurnDoesNotPolluteNextContext() {
        Fixture fixture = new Fixture();
        Session session = fixture.commandService.createSession(
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash"
        );

        fixture.modelGateway.failNext = true;
        TurnStartResult failed = fixture.commandService.startTurn(
                "project-1",
                session.id(),
                "This turn will fail"
        );

        assertThatThrownBy(
                () -> fixture.turnExecutor.execute(
                        failed.turn().id()
                )
        ).isInstanceOf(IllegalStateException.class);

        SessionSnapshot failedSnapshot = fixture.queryService.getSnapshot(
                "project-1",
                session.id()
        );
        assertThat(failedSnapshot.turns().get(0).status())
                .isEqualTo(TurnStatus.FAILED);

        TurnStartResult retry = fixture.commandService.startTurn(
                "project-1",
                session.id(),
                "Try again"
        );
        fixture.turnExecutor.execute(retry.turn().id());

        ModelRequest retryRequest =
                fixture.modelGateway.requests.get(0);
        assertThat(retryRequest.messages())
                .extracting(
                        ModelMessage::role,
                        ModelMessage::content
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                ModelMessage.Role.USER,
                                "Try again"
                        )
                );
    }

    @Test
    void duplicateExecutionIsIgnoredAfterTurnIsClaimed() {
        Fixture fixture = new Fixture();
        Session session = fixture.commandService.createSession(
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash"
        );

        TurnStartResult turn = fixture.commandService.startTurn(
                "project-1",
                session.id(),
                "Hello"
        );

        assertThat(fixture.turnExecutor.execute(turn.turn().id()))
                .isTrue();
        assertThat(fixture.turnExecutor.execute(turn.turn().id()))
                .isFalse();
        assertThat(fixture.modelGateway.requests).hasSize(1);
    }

    @Test
    void projectIdentityIsPartOfTheSessionBoundary() {
        Fixture fixture = new Fixture();
        Session session = fixture.commandService.createSession(
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash"
        );

        assertThatThrownBy(
                () -> fixture.queryService.getSnapshot(
                        "project-2",
                        session.id()
                )
        ).isInstanceOf(SessionNotFoundException.class);

        assertThatThrownBy(
                () -> fixture.commandService.startTurn(
                        "project-2",
                        session.id(),
                        "hello"
                )
        ).isInstanceOf(SessionNotFoundException.class);
    }

    @Test
    void turnOwnsItsStateTransitionRules() {
        Instant now = Instant.now();
        Turn pending = new Turn(
                "turn-1",
                "session-1",
                TurnStatus.PENDING,
                null,
                now,
                now
        );

        assertThatThrownBy(() -> pending.markSucceeded(now))
                .isInstanceOf(IllegalStateException.class);

        Turn running = pending.markRunning(now);
        assertThatThrownBy(() -> running.markRunning(now))
                .isInstanceOf(IllegalStateException.class);

        Turn failed = running.markFailed("boom", now);
        assertThat(failed.status())
                .isEqualTo(TurnStatus.FAILED);
        assertThat(failed.errorMessage()).isEqualTo("boom");
        assertThatThrownBy(() -> failed.markSucceeded(now))
                .isInstanceOf(IllegalStateException.class);
    }

    private static final class Fixture {

        private final MemorySessionRepository sessionRepository =
                new MemorySessionRepository();
        private final MemoryExecutionRepository executionRepository =
                new MemoryExecutionRepository();
        private final RecordingModelGateway modelGateway =
                new RecordingModelGateway();

        private final SessionCommandService commandService;
        private final SessionQueryService queryService;
        private final TurnExecutor turnExecutor;

        private Fixture() {
            TransactionRunner transactionRunner =
                    new DirectTransactionRunner();

            commandService = new SessionCommandService(
                    sessionRepository,
                    executionRepository
            );
            queryService = new SessionQueryService(
                    sessionRepository,
                    executionRepository
            );
            turnExecutor = new TurnExecutor(
                    sessionRepository,
                    executionRepository,
                    modelGateway,
                    new TurnPromptAssembler(),
                    transactionRunner
            );
        }
    }

    private static final class DirectTransactionRunner
            implements TransactionRunner {

        @Override
        public <T> T required(Supplier<T> action) {
            return action.get();
        }
    }

    private static final class MemorySessionRepository
            implements SessionRepository {

        private final Map<String, Session> sessions = new HashMap<>();

        @Override
        public Session save(Session session) {
            sessions.put(session.id(), session);
            return session;
        }

        @Override
        public Optional<Session> findById(String sessionId) {
            return Optional.ofNullable(sessions.get(sessionId));
        }

        @Override
        public List<Session> findByProjectId(String projectId) {
            return sessions.values().stream()
                    .filter(session ->
                            session.projectId().equals(projectId)
                    )
                    .toList();
        }
    }

    private static final class MemoryExecutionRepository
            implements SessionExecutionRepository {

        private final Map<String, Turn> turns = new HashMap<>();
        private final List<SessionMessage> messages = new ArrayList<>();
        private final Map<String, AtomicLong> sequences = new HashMap<>();

        @Override
        public TurnStartResult createPendingTurn(
                Turn turn,
                String userMessageId,
                String content,
                Instant createdAt
        ) {
            boolean busy = turns.values().stream()
                    .anyMatch(existing ->
                            existing.sessionId().equals(turn.sessionId())
                                    && existing.status().active()
                    );
            if (busy) {
                throw new SessionBusyException(turn.sessionId());
            }

            turns.put(turn.id(), turn);
            SessionMessage userMessage = newMessage(
                    userMessageId,
                    turn.sessionId(),
                    turn.id(),
                    SessionMessage.Role.USER,
                    content,
                    createdAt
            );
            messages.add(userMessage);
            return new TurnStartResult(turn, userMessage);
        }

        @Override
        public Optional<Turn> claimPendingTurn(
                String turnId,
                Instant claimedAt
        ) {
            Turn current = turns.get(turnId);
            if (current == null
                    || current.status() != TurnStatus.PENDING) {
                return Optional.empty();
            }

            Turn running = current.markRunning(claimedAt);
            turns.put(turnId, running);
            return Optional.of(running);
        }

        @Override
        public Turn completeTurn(
                Turn runningTurn,
                String assistantMessageId,
                String content,
                Instant completedAt
        ) {
            Turn current = turns.get(runningTurn.id());
            Turn succeeded = current.markSucceeded(completedAt);
            SessionMessage assistantMessage = newMessage(
                    assistantMessageId,
                    current.sessionId(),
                    current.id(),
                    SessionMessage.Role.ASSISTANT,
                    content,
                    completedAt
            );
            messages.add(assistantMessage);
            turns.put(current.id(), succeeded);
            return succeeded;
        }

        @Override
        public Turn failTurn(
                Turn runningTurn,
                String errorMessage,
                Instant failedAt
        ) {
            Turn current = turns.get(runningTurn.id());
            Turn failed = current.markFailed(
                    errorMessage,
                    failedAt
            );
            turns.put(current.id(), failed);
            return failed;
        }

        @Override
        public Optional<Turn> findTurnById(String turnId) {
            return Optional.ofNullable(turns.get(turnId));
        }

        @Override
        public List<Turn> findTurnsBySessionId(String sessionId) {
            return turns.values().stream()
                    .filter(turn ->
                            turn.sessionId().equals(sessionId)
                    )
                    .toList();
        }

        @Override
        public List<SessionMessage> findMessagesBySessionId(
                String sessionId
        ) {
            return messages.stream()
                    .filter(message ->
                            message.sessionId().equals(sessionId)
                    )
                    .toList();
        }

        private SessionMessage newMessage(
                String messageId,
                String sessionId,
                String turnId,
                SessionMessage.Role role,
                String content,
                Instant createdAt
        ) {
            long sequence = sequences.computeIfAbsent(
                    sessionId,
                    ignored -> new AtomicLong()
            ).incrementAndGet();

            return new SessionMessage(
                    messageId,
                    sessionId,
                    turnId,
                    role,
                    content,
                    sequence,
                    createdAt
            );
        }
    }

    private static final class RecordingModelGateway
            implements ModelGateway {

        private final List<ModelRequest> requests = new ArrayList<>();
        private boolean failNext;

        @Override
        public ModelReply chat(
                String provider,
                ModelRequest request
        ) {
            if (failNext) {
                failNext = false;
                throw new IllegalStateException("model failed");
            }

            requests.add(request);
            return new ModelReply(
                    "Assistant " + requests.size()
            );
        }
    }
}
