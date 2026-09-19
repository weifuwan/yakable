package io.yakable.dao;

import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.project.Project;
import io.yakable.domain.project.ProjectStatus;
import io.yakable.domain.project.repository.ProjectRepository;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionBusyException;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionStatus;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.domain.session.TurnStatus;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.ComponentScan;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(
        classes = DaoPersistenceIntegrationTest.TestApplication.class,
        properties = {
                "spring.datasource.url="
                        + "jdbc:h2:mem:yakable-dao;"
                        + "MODE=MySQL;"
                        + "DB_CLOSE_DELAY=-1;"
                        + "DATABASE_TO_LOWER=TRUE;"
                        + "LOCK_TIMEOUT=10000",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.datasource.driver-class-name=org.h2.Driver"
        }
)
class DaoPersistenceIntegrationTest {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private SessionExecutionRepository executionRepository;

    @Autowired
    private TransactionRunner transactionRunner;

    @Test
    void persistsProjectSessionTurnAndOrderedMessages() {
        Fixture fixture = createFixture();

        TurnStartResult first = executionRepository.createPendingTurn(
                fixture.pendingTurn(),
                UUID.randomUUID().toString(),
                "First question",
                fixture.now()
        );

        Turn running = executionRepository
                .claimPendingTurn(
                        first.turn().id(),
                        fixture.now().plusSeconds(1)
                )
                .orElseThrow();

        executionRepository.completeTurn(
                running,
                UUID.randomUUID().toString(),
                "First answer",
                fixture.now().plusSeconds(2)
        );

        Turn secondTurn = new Turn(
                UUID.randomUUID().toString(),
                fixture.session().id(),
                TurnStatus.PENDING,
                null,
                fixture.now().plusSeconds(3),
                fixture.now().plusSeconds(3)
        );

        TurnStartResult second = executionRepository.createPendingTurn(
                secondTurn,
                UUID.randomUUID().toString(),
                "Second question",
                fixture.now().plusSeconds(3)
        );

        assertThat(projectRepository.findById(
                fixture.project().id()
        )).contains(fixture.project());

        assertThat(sessionRepository.findById(
                fixture.session().id()
        )).contains(fixture.session());

        assertThat(executionRepository.findTurnsBySessionId(
                fixture.session().id()
        ))
                .extracting(Turn::status)
                .containsExactly(
                        TurnStatus.SUCCEEDED,
                        TurnStatus.PENDING
                );

        assertThat(executionRepository.findMessagesBySessionId(
                fixture.session().id()
        ))
                .extracting(
                        SessionMessage::role,
                        SessionMessage::sequence,
                        SessionMessage::content
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                SessionMessage.Role.USER,
                                1L,
                                "First question"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                SessionMessage.Role.ASSISTANT,
                                2L,
                                "First answer"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                SessionMessage.Role.USER,
                                3L,
                                "Second question"
                        )
                );

        assertThat(second.userMessage().sequence()).isEqualTo(3L);
    }

    @Test
    void transactionRunnerRollsBackAggregateBootstrap() {
        Instant now = now();
        String projectId = UUID.randomUUID().toString();
        String sessionId = UUID.randomUUID().toString();

        Project project = project(projectId, now);
        Session session = session(sessionId, projectId, now);
        Turn turn = pendingTurn(
                UUID.randomUUID().toString(),
                sessionId,
                now
        );

        assertThatThrownBy(() -> transactionRunner.required(() -> {
            projectRepository.save(project);
            sessionRepository.save(session);
            executionRepository.createPendingTurn(
                    turn,
                    UUID.randomUUID().toString(),
                    "rollback",
                    now
            );
            throw new IllegalStateException("rollback");
        }))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("rollback");

        assertThat(projectRepository.findById(projectId)).isEmpty();
        assertThat(sessionRepository.findById(sessionId)).isEmpty();
        assertThat(executionRepository.findTurnById(turn.id()))
                .isEmpty();
    }

    @Test
    void concurrentTurnCreationAllowsOnlyOneActiveTurn()
            throws Exception {
        Fixture fixture = createFixture();

        int workers = 8;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();

        try (ExecutorService executor =
                     Executors.newFixedThreadPool(workers)) {
            for (int index = 0; index < workers; index++) {
                int worker = index;
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await();

                    Instant now = now();
                    Turn turn = pendingTurn(
                            UUID.randomUUID().toString(),
                            fixture.session().id(),
                            now
                    );

                    try {
                        executionRepository.createPendingTurn(
                                turn,
                                UUID.randomUUID().toString(),
                                "message-" + worker,
                                now
                        );
                        return true;
                    } catch (SessionBusyException exception) {
                        return false;
                    }
                }));
            }

            ready.await();
            start.countDown();

            long successes = 0;
            for (Future<Boolean> future : futures) {
                if (future.get()) {
                    successes++;
                }
            }

            assertThat(successes).isEqualTo(1);
            assertThat(executionRepository.findTurnsBySessionId(
                    fixture.session().id()
            )).hasSize(1);
            assertThat(executionRepository.findMessagesBySessionId(
                    fixture.session().id()
            ))
                    .extracting(SessionMessage::sequence)
                    .containsExactly(1L);
        }
    }

    private Fixture createFixture() {
        Instant now = now();
        Project project = project(
                UUID.randomUUID().toString(),
                now
        );
        Session session = session(
                UUID.randomUUID().toString(),
                project.id(),
                now
        );

        transactionRunner.required(() -> {
            projectRepository.save(project);
            sessionRepository.save(session);
            return Boolean.TRUE;
        });

        return new Fixture(
                project,
                session,
                pendingTurn(
                        UUID.randomUUID().toString(),
                        session.id(),
                        now
                ),
                now
        );
    }

    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    private static Project project(
            String id,
            Instant now
    ) {
        return new Project(
                id,
                "Persistent project",
                ProjectStatus.CREATED,
                now,
                now
        );
    }

    private static Session session(
            String id,
            String projectId,
            Instant now
    ) {
        return new Session(
                id,
                projectId,
                "Persistent session",
                "deepseek",
                "deepseek-flash",
                SessionStatus.ACTIVE,
                now,
                now
        );
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
                null,
                now,
                now
        );
    }

    private record Fixture(
            Project project,
            Session session,
            Turn pendingTurn,
            Instant now
    ) {
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @ComponentScan("io.yakable.dao")
    static class TestApplication {
    }
}
