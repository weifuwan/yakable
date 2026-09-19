package io.yakable.application.session;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.model.ModelGateway;
import io.yakable.application.model.ModelMessage;
import io.yakable.application.model.ModelReply;
import io.yakable.application.model.ModelRequest;
import io.yakable.application.model.ModelUsage;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionBusyException;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionNotFoundException;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.domain.session.TurnStatus;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
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
        Session session = fixture.createSession();

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

        Turn firstTurn = snapshot.turns().get(0);
        assertThat(firstTurn.attemptCount()).isEqualTo(1);
        assertThat(firstTurn.startedAt()).isNotNull();
        assertThat(firstTurn.finishedAt()).isNotNull();
        assertThat(firstTurn.durationMillis()).isNotNull();
        assertThat(firstTurn.durationMillis()).isGreaterThanOrEqualTo(0L);
        assertThat(firstTurn.invocation()).isNotNull();
        assertThat(firstTurn.invocation().provider()).isEqualTo("deepseek");
        assertThat(firstTurn.invocation().model()).isEqualTo("deepseek-flash");
        assertThat(firstTurn.invocation().usage().inputTokens()).isEqualTo(10L);
        assertThat(firstTurn.invocation().usage().outputTokens()).isEqualTo(5L);
        assertThat(firstTurn.invocation().usage().totalTokens()).isEqualTo(15L);
        assertThat(firstTurn.invocation().providerRequestId()).isEqualTo("req-1");
        assertThat(firstTurn.invocation().finishReason()).isEqualTo("stop");

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
        Session session = fixture.createSession();

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
        Turn failedTurn = failedSnapshot.turns().get(0);
        assertThat(failedTurn.status())
                .isEqualTo(TurnStatus.FAILED);
        assertThat(failedTurn.startedAt()).isNotNull();
        assertThat(failedTurn.finishedAt()).isNotNull();

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
    void contextFailureAfterClaimMarksTurnFailed() {
        Fixture fixture = new Fixture();
        Session session = fixture.createSession();

        TurnStartResult turn = fixture.commandService.startTurn(
                "project-1",
                session.id(),
                "Hello"
        );
        fixture.executionRepository.failNextMessageRead = true;

        assertThatThrownBy(
                () -> fixture.turnExecutor.execute(turn.turn().id())
        )
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("context failed");

        Turn persisted = fixture.executionRepository
                .findTurnById(turn.turn().id())
                .orElseThrow();

        assertThat(persisted.status()).isEqualTo(TurnStatus.FAILED);
        assertThat(persisted.errorMessage()).isEqualTo("context failed");
        assertThat(persisted.startedAt()).isNotNull();
        assertThat(persisted.finishedAt()).isNotNull();
        assertThat(persisted.invocation()).isNotNull();
        assertThat(persisted.invocation().provider()).isEqualTo("deepseek");
        assertThat(persisted.invocation().model()).isEqualTo("deepseek-flash");
    }

    @Test
    void duplicateExecutionIsIgnoredAfterTurnIsClaimed() {
        Fixture fixture = new Fixture();
        Session session = fixture.createSession();

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
    void recoveryRequeuesStaleRunningAndDispatchesPending() {
        Fixture fixture = new Fixture();
        Session session = fixture.createSession();

        Instant claimedAt = Instant.now();
        TurnStartResult started = fixture.commandService.startTurn(
                "project-1",
                session.id(),
                "Recover me"
        );
        Turn running = fixture.executionRepository
                .claimPendingTurn(
                        started.turn().id(),
                        claimedAt,
                        "deepseek",
                        "deepseek-flash"
                )
                .orElseThrow();

        List<String> dispatched = new ArrayList<>();
        TurnDispatcher dispatcher = turnId -> {
            dispatched.add(turnId);
            return true;
        };

        TurnExecutionRecoveryService recoveryService =
                new TurnExecutionRecoveryService(
                        fixture.executionRepository,
                        dispatcher,
                        Duration.ofMinutes(10),
                        10
                );

        TurnExecutionRecoveryService.TurnRecoveryResult result =
                recoveryService.recoverAndDispatch(
                        claimedAt.plus(Duration.ofMinutes(20))
                );

        assertThat(result.recoveredRunningTurns()).isEqualTo(1);
        assertThat(result.pendingTurns()).isEqualTo(1);
        assertThat(result.acceptedDispatches()).isEqualTo(1);
        assertThat(dispatched).containsExactly(running.id());

        Turn recovered = fixture.executionRepository
                .findTurnById(running.id())
                .orElseThrow();
        assertThat(recovered.status()).isEqualTo(TurnStatus.PENDING);
        assertThat(recovered.attemptCount()).isEqualTo(1);
        assertThat(recovered.startedAt()).isNull();
        assertThat(recovered.finishedAt()).isNull();
        assertThat(recovered.invocation()).isNull();
    }

    @Test
    void projectIdentityIsPartOfTheSessionBoundary() {
        Fixture fixture = new Fixture();
        Session session = fixture.createSession();

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
    void turnOwnsExecutionAndRecoveryTransitions() {
        Instant now = Instant.now();
        Turn pending = pendingTurn(
                "turn-1",
                "session-1",
                now
        );

        assertThatThrownBy(() -> pending.markSucceeded(
                now,
                TurnInvocation.started("deepseek", "deepseek-flash")
        ))
                .isInstanceOf(IllegalStateException.class);

        Turn running = pending.markRunning(
                now.plusSeconds(1),
                "deepseek",
                "deepseek-flash"
        );
        assertThat(running.attemptCount()).isEqualTo(1);
        assertThat(running.startedAt()).isEqualTo(now.plusSeconds(1));

        Turn recovered = running.recoverToPending(
                now.plusSeconds(2)
        );
        assertThat(recovered.status()).isEqualTo(TurnStatus.PENDING);
        assertThat(recovered.attemptCount()).isEqualTo(1);
        assertThat(recovered.startedAt()).isNull();

        Turn retried = recovered.markRunning(
                now.plusSeconds(3),
                "deepseek",
                "deepseek-flash"
        );
        assertThat(retried.attemptCount()).isEqualTo(2);

        Turn failed = retried.markFailed(
                "boom",
                now.plusSeconds(4)
        );
        assertThat(failed.status()).isEqualTo(TurnStatus.FAILED);
        assertThat(failed.finishedAt()).isEqualTo(now.plusSeconds(4));
        assertThatThrownBy(
                () -> failed.markSucceeded(
                        now.plusSeconds(5),
                        failed.invocation()
                )
        ).isInstanceOf(IllegalStateException.class);
    }

    private static Turn pendingTurn(
            String id,
            String sessionId,
            Instant now
    ) {
        return new Turn(
                id,
                sessionId,
                TurnStatus.PENDING,
                0,
                null,
                null,
                null,
                null,
                now,
                now
        );
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
                    new MemorySessionQueryRepository(
                            sessionRepository,
                            executionRepository
                    )
            );
            turnExecutor = new TurnExecutor(
                    sessionRepository,
                    executionRepository,
                    modelGateway,
                    new TurnPromptAssembler(),
                    transactionRunner
            );
        }

        private Session createSession() {
            return commandService.createSession(
                    "project-1",
                    "CRM",
                    "deepseek",
                    "deepseek-flash"
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
        private boolean failNextMessageRead;

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
                Instant claimedAt,
                String provider,
                String model
        ) {
            Turn current = turns.get(turnId);
            if (current == null
                    || current.status() != TurnStatus.PENDING) {
                return Optional.empty();
            }

            Turn running = current.markRunning(
                    claimedAt,
                    provider,
                    model
            );
            turns.put(turnId, running);
            return Optional.of(running);
        }

        @Override
        public Turn completeTurn(
                Turn runningTurn,
                String assistantMessageId,
                String content,
                TurnInvocation completedInvocation,
                Instant completedAt
        ) {
            Turn current = turns.get(runningTurn.id());
            Turn succeeded = current.markSucceeded(
                    completedAt,
                    completedInvocation
            );
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
        public int recoverStaleRunningTurns(
                Instant staleBefore,
                Instant recoveredAt
        ) {
            int recovered = 0;
            for (Map.Entry<String, Turn> entry : turns.entrySet()) {
                Turn turn = entry.getValue();
                if (turn.status() == TurnStatus.RUNNING
                        && turn.startedAt() != null
                        && turn.startedAt().isBefore(staleBefore)) {
                    entry.setValue(
                            turn.recoverToPending(recoveredAt)
                    );
                    recovered++;
                }
            }
            return recovered;
        }

        @Override
        public List<String> findPendingTurnIds(int limit) {
            return turns.values().stream()
                    .filter(turn ->
                            turn.status() == TurnStatus.PENDING
                    )
                    .sorted(Comparator.comparing(Turn::createdAt))
                    .limit(limit)
                    .map(Turn::id)
                    .toList();
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
                    .sorted(Comparator.comparing(Turn::createdAt))
                    .toList();
        }

        @Override
        public List<SessionMessage> findMessagesBySessionId(
                String sessionId
        ) {
            if (failNextMessageRead) {
                failNextMessageRead = false;
                throw new IllegalStateException("context failed");
            }

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

    private static final class MemorySessionQueryRepository
            implements SessionQueryRepository {

        private final MemorySessionRepository sessionRepository;
        private final MemoryExecutionRepository executionRepository;

        private MemorySessionQueryRepository(
                MemorySessionRepository sessionRepository,
                MemoryExecutionRepository executionRepository
        ) {
            this.sessionRepository = sessionRepository;
            this.executionRepository = executionRepository;
        }

        @Override
        public Optional<SessionSnapshot> findSnapshot(
                String projectId,
                String sessionId
        ) {
            Optional<Session> session = ownedSession(
                    projectId,
                    sessionId
            );
            if (session.isEmpty()) {
                return Optional.empty();
            }

            return Optional.of(new SessionSnapshot(
                    session.get(),
                    executionRepository.findTurnsBySessionId(sessionId),
                    executionRepository.findMessagesBySessionId(sessionId)
                            .stream()
                            .sorted(
                                    Comparator.comparingLong(
                                            SessionMessage::sequence
                                    )
                            )
                            .toList()
            ));
        }

        @Override
        public Optional<SessionChanges> findChanges(
                String projectId,
                String sessionId,
                long afterSequence
        ) {
            if (ownedSession(projectId, sessionId).isEmpty()) {
                return Optional.empty();
            }

            List<Turn> turns =
                    executionRepository.findTurnsBySessionId(sessionId);
            if (turns.isEmpty()) {
                return Optional.empty();
            }

            List<SessionMessage> messages =
                    executionRepository.findMessagesBySessionId(sessionId)
                            .stream()
                            .filter(message ->
                                    message.sequence() > afterSequence
                            )
                            .sorted(
                                    Comparator.comparingLong(
                                            SessionMessage::sequence
                                    )
                            )
                            .toList();

            long latestSequence = messages.isEmpty()
                    ? afterSequence
                    : messages.get(messages.size() - 1).sequence();

            return Optional.of(new SessionChanges(
                    turns.get(turns.size() - 1),
                    messages,
                    latestSequence
            ));
        }

        @Override
        public Optional<SessionMessagePage> findMessagePage(
                String projectId,
                String sessionId,
                Long beforeSequence,
                int limit
        ) {
            if (ownedSession(projectId, sessionId).isEmpty()) {
                return Optional.empty();
            }

            List<SessionMessage> descending =
                    executionRepository.findMessagesBySessionId(sessionId)
                            .stream()
                            .filter(message ->
                                    beforeSequence == null
                                            || message.sequence()
                                            < beforeSequence
                            )
                            .sorted(
                                    Comparator.comparingLong(
                                            SessionMessage::sequence
                                    ).reversed()
                            )
                            .limit(limit + 1L)
                            .toList();

            boolean hasMore = descending.size() > limit;
            List<SessionMessage> page = new ArrayList<>(
                    hasMore
                            ? descending.subList(0, limit)
                            : descending
            );
            page.sort(
                    Comparator.comparingLong(
                            SessionMessage::sequence
                    )
            );

            Long nextBeforeSequence =
                    hasMore && !page.isEmpty()
                            ? page.get(0).sequence()
                            : null;

            return Optional.of(new SessionMessagePage(
                    page,
                    nextBeforeSequence,
                    hasMore
            ));
        }

        private Optional<Session> ownedSession(
                String projectId,
                String sessionId
        ) {
            return sessionRepository.findById(sessionId)
                    .filter(session ->
                            session.projectId().equals(projectId)
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
            int requestNumber = requests.size();
            return new ModelReply(
                    "Assistant " + requestNumber,
                    provider,
                    request.model(),
                    new ModelUsage(10L, 5L, 15L),
                    "req-" + requestNumber,
                    "stop"
            );
        }
    }
}
