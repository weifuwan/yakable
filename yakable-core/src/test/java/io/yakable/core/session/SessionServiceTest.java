package io.yakable.core.session;

import io.yakable.core.model.ModelPluginRegistry;
import io.yakable.core.model.ModelRuntime;
import io.yakable.plugin.model.api.LlmMessage;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;
import io.yakable.plugin.model.api.LlmUsage;
import io.yakable.plugin.model.api.ModelCapability;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginConfiguration;
import io.yakable.plugin.model.api.ModelPluginDescriptor;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SessionServiceTest {

    @Test
    void persistsTurnLifecycleAndCompleteSuccessfulHistory() {
        Fixture fixture = new Fixture();
        Session session = fixture.service.createSession(
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash"
        );

        TurnStartResult first = fixture.service.startTurn(
                session.id(),
                "First question"
        );
        assertThat(first.turn().status()).isEqualTo(TurnStatus.PENDING);

        fixture.service.executeTurn(first.turn().id());

        TurnStartResult second = fixture.service.startTurn(
                session.id(),
                "Second question"
        );
        fixture.service.executeTurn(second.turn().id());

        SessionSnapshot snapshot =
                fixture.service.getSnapshot(session.id());

        assertThat(snapshot.turns())
                .extracting(Turn::status)
                .containsExactly(
                        TurnStatus.SUCCEEDED,
                        TurnStatus.SUCCEEDED
                );

        assertThat(snapshot.messages())
                .extracting(SessionMessage::sequence)
                .containsExactly(1L, 2L, 3L, 4L);

        LlmRequest secondRequest = fixture.plugin.requests.get(1);
        assertThat(secondRequest.messages())
                .extracting(LlmMessage::role, LlmMessage::content)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                LlmMessage.Role.USER,
                                "First question"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                LlmMessage.Role.ASSISTANT,
                                "Assistant 1"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                LlmMessage.Role.USER,
                                "Second question"
                        )
                );
    }

    @Test
    void failedTurnDoesNotPolluteTheNextModelContext() {
        Fixture fixture = new Fixture();
        Session session = fixture.service.createSession(
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash"
        );

        fixture.plugin.failNext = true;
        TurnStartResult failed = fixture.service.startTurn(
                session.id(),
                "This turn will fail"
        );

        assertThatThrownBy(
                () -> fixture.service.executeTurn(failed.turn().id())
        ).isInstanceOf(IllegalStateException.class);

        SessionSnapshot failedSnapshot =
                fixture.service.getSnapshot(session.id());
        assertThat(failedSnapshot.turns().get(0).status())
                .isEqualTo(TurnStatus.FAILED);
        assertThat(failedSnapshot.turns().get(0).errorMessage())
                .isEqualTo("model failed");

        TurnStartResult retry = fixture.service.startTurn(
                session.id(),
                "Try again"
        );
        fixture.service.executeTurn(retry.turn().id());

        LlmRequest retryRequest = fixture.plugin.requests.get(0);
        assertThat(retryRequest.messages())
                .extracting(LlmMessage::role, LlmMessage::content)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                LlmMessage.Role.USER,
                                "Try again"
                        )
                );
    }

    @Test
    void rejectsBlankContentBeforePersistingATurn() {
        Fixture fixture = new Fixture();
        Session session = fixture.service.createSession(
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash"
        );

        assertThatThrownBy(
                () -> fixture.service.startTurn(session.id(), "   ")
        ).isInstanceOf(IllegalArgumentException.class);

        SessionSnapshot snapshot =
                fixture.service.getSnapshot(session.id());
        assertThat(snapshot.turns()).isEmpty();
        assertThat(snapshot.messages()).isEmpty();
    }

    @Test
    void rejectsAnotherTurnWhileOneIsPending() {
        Fixture fixture = new Fixture();
        Session session = fixture.service.createSession(
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash"
        );

        fixture.service.startTurn(session.id(), "First");

        assertThatThrownBy(
                () -> fixture.service.startTurn(session.id(), "Second")
        )
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("active turn");
    }

    private static final class Fixture {

        private final RecordingModelPlugin plugin =
                new RecordingModelPlugin();
        private final SessionService service;

        private Fixture() {
            ModelRuntime runtime = new ModelRuntime(
                    ModelPluginRegistry.from(List.of(plugin)),
                    provider -> new ModelPluginConfiguration(
                            "test-key",
                            "https://example.test"
                    )
            );
            service = new SessionService(
                    new MemorySessionRepository(),
                    new MemoryTurnRepository(),
                    new MemoryMessageRepository(),
                    runtime
            );
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
        public java.util.Optional<Session> findById(String sessionId) {
            return java.util.Optional.ofNullable(sessions.get(sessionId));
        }

        @Override
        public List<Session> findByProjectId(String projectId) {
            return sessions.values().stream()
                    .filter(session -> session.projectId().equals(projectId))
                    .toList();
        }
    }

    private static final class MemoryTurnRepository
            implements TurnRepository {

        private final Map<String, Turn> turns = new HashMap<>();

        @Override
        public Turn save(Turn turn) {
            turns.put(turn.id(), turn);
            return turn;
        }

        @Override
        public java.util.Optional<Turn> findById(String turnId) {
            return java.util.Optional.ofNullable(turns.get(turnId));
        }

        @Override
        public List<Turn> findBySessionId(String sessionId) {
            return turns.values().stream()
                    .filter(turn -> turn.sessionId().equals(sessionId))
                    .toList();
        }
    }

    private static final class MemoryMessageRepository
            implements SessionMessageRepository {

        private final List<SessionMessage> messages = new ArrayList<>();
        private final Map<String, AtomicLong> sequences = new HashMap<>();

        @Override
        public SessionMessage save(SessionMessage message) {
            messages.add(message);
            return message;
        }

        @Override
        public List<SessionMessage> findBySessionId(String sessionId) {
            return messages.stream()
                    .filter(message -> message.sessionId().equals(sessionId))
                    .toList();
        }

        @Override
        public long nextSequence(String sessionId) {
            return sequences.computeIfAbsent(
                    sessionId,
                    ignored -> new AtomicLong()
            ).incrementAndGet();
        }
    }

    private static final class RecordingModelPlugin implements ModelPlugin {

        private static final ModelPluginDescriptor DESCRIPTOR =
                new ModelPluginDescriptor(
                        "deepseek",
                        "DeepSeek",
                        ModelPluginDescriptor.CURRENT_API_VERSION,
                        Set.of(ModelCapability.CHAT)
                );

        private final List<LlmRequest> requests = new ArrayList<>();
        private boolean failNext;

        @Override
        public ModelPluginDescriptor descriptor() {
            return DESCRIPTOR;
        }

        @Override
        public LlmResponse chat(
                ModelPluginConfiguration configuration,
                LlmRequest request
        ) {
            if (failNext) {
                failNext = false;
                throw new IllegalStateException("model failed");
            }

            requests.add(request);
            return new LlmResponse(
                    "Assistant " + requests.size(),
                    new LlmUsage(null, null, null)
            );
        }
    }
}
