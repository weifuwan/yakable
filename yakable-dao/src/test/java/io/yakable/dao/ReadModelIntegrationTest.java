package io.yakable.dao;

import io.yakable.application.project.ProjectQueryRepository;
import io.yakable.application.project.ProjectSummary;
import io.yakable.application.query.PageResult;
import io.yakable.application.session.SessionChanges;
import io.yakable.application.session.SessionMessagePage;
import io.yakable.application.session.SessionQueryRepository;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.project.Project;
import io.yakable.domain.project.ProjectStatus;
import io.yakable.domain.project.repository.ProjectRepository;
import io.yakable.domain.session.Session;
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

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = ReadModelIntegrationTest.TestApplication.class,
        properties = {
                "spring.datasource.url="
                        + "jdbc:h2:mem:yakable-read-model;"
                        + "MODE=MySQL;"
                        + "DB_CLOSE_DELAY=-1;"
                        + "DATABASE_TO_LOWER=TRUE",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.datasource.driver-class-name=org.h2.Driver"
        }
)
class ReadModelIntegrationTest {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private SessionExecutionRepository executionRepository;

    @Autowired
    private ProjectQueryRepository projectQueryRepository;

    @Autowired
    private SessionQueryRepository sessionQueryRepository;

    @Autowired
    private TransactionRunner transactionRunner;

    @Test
    void projectPageUsesLatestSessionWithoutNPlusOneAssembly() {
        Instant base = now();

        Project projectOne = project("project-1", "Project 1", base);
        Project projectTwo = project(
                "project-2",
                "Project 2",
                base.plusSeconds(1)
        );

        Session projectOneOld = session(
                "session-1-old",
                projectOne.id(),
                base.plusSeconds(1)
        );
        Session projectOneLatest = session(
                "session-1-latest",
                projectOne.id(),
                base.plusSeconds(3)
        );
        Session projectTwoLatest = session(
                "session-2-latest",
                projectTwo.id(),
                base.plusSeconds(4)
        );

        transactionRunner.required(() -> {
            projectRepository.save(projectOne);
            projectRepository.save(projectTwo);
            sessionRepository.save(projectOneOld);
            sessionRepository.save(projectOneLatest);
            sessionRepository.save(projectTwoLatest);
            return Boolean.TRUE;
        });

        PageResult<ProjectSummary> firstPage =
                projectQueryRepository.findProjectSummaries(1, 1);
        PageResult<ProjectSummary> secondPage =
                projectQueryRepository.findProjectSummaries(2, 1);

        assertThat(firstPage.total()).isEqualTo(2);
        assertThat(firstPage.pages()).isEqualTo(2);
        assertThat(firstPage.records())
                .extracting(
                        ProjectSummary::id,
                        ProjectSummary::latestSessionId
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                "project-2",
                                "session-2-latest"
                        )
                );

        assertThat(secondPage.records())
                .extracting(
                        ProjectSummary::id,
                        ProjectSummary::latestSessionId
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                "project-1",
                                "session-1-latest"
                        )
                );
    }

    @Test
    void sessionChangesUseMessageSequenceCursor() {
        Instant base = now();
        Project project = project("project-changes", "Changes", base);
        Session session = session(
                "session-changes",
                project.id(),
                base
        );

        transactionRunner.required(() -> {
            projectRepository.save(project);
            sessionRepository.save(session);
            return Boolean.TRUE;
        });

        Turn pending = pendingTurn(
                "turn-changes",
                session.id(),
                base.plusSeconds(1)
        );
        TurnStartResult started =
                executionRepository.createPendingTurn(
                        pending,
                        "message-user",
                        "Question",
                        base.plusSeconds(1)
                );
        Turn running = executionRepository.claimPendingTurn(
                started.turn().id(),
                base.plusSeconds(2)
        ).orElseThrow();
        executionRepository.completeTurn(
                running,
                "message-assistant",
                "Answer",
                base.plusSeconds(3)
        );

        SessionChanges changes = sessionQueryRepository.findChanges(
                project.id(),
                session.id(),
                1L
        ).orElseThrow();

        assertThat(changes.latestTurn().status())
                .isEqualTo(TurnStatus.SUCCEEDED);
        assertThat(changes.messages())
                .extracting(
                        io.yakable.domain.session.SessionMessage::sequence,
                        io.yakable.domain.session.SessionMessage::content
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                2L,
                                "Answer"
                        )
                );
        assertThat(changes.latestSequence()).isEqualTo(2L);
    }

    @Test
    void messageHistoryUsesBeforeSequenceCursor() {
        Instant base = now();
        Project project = project("project-history", "History", base);
        Session session = session(
                "session-history",
                project.id(),
                base
        );

        transactionRunner.required(() -> {
            projectRepository.save(project);
            sessionRepository.save(session);
            return Boolean.TRUE;
        });

        Turn pending = pendingTurn(
                "turn-history",
                session.id(),
                base.plusSeconds(1)
        );
        TurnStartResult started =
                executionRepository.createPendingTurn(
                        pending,
                        "message-history-user",
                        "Question",
                        base.plusSeconds(1)
                );
        Turn running = executionRepository.claimPendingTurn(
                started.turn().id(),
                base.plusSeconds(2)
        ).orElseThrow();
        executionRepository.completeTurn(
                running,
                "message-history-assistant",
                "Answer",
                base.plusSeconds(3)
        );

        SessionMessagePage latest =
                sessionQueryRepository.findMessagePage(
                        project.id(),
                        session.id(),
                        null,
                        1
                ).orElseThrow();

        assertThat(latest.messages())
                .extracting(io.yakable.domain.session.SessionMessage::sequence)
                .containsExactly(2L);
        assertThat(latest.hasMore()).isTrue();
        assertThat(latest.nextBeforeSequence()).isEqualTo(2L);

        SessionMessagePage older =
                sessionQueryRepository.findMessagePage(
                        project.id(),
                        session.id(),
                        latest.nextBeforeSequence(),
                        1
                ).orElseThrow();

        assertThat(older.messages())
                .extracting(message -> message.sequence())
                .containsExactly(1L);
        assertThat(older.hasMore()).isFalse();
        assertThat(older.nextBeforeSequence()).isNull();
    }

    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    private static Project project(
            String id,
            String name,
            Instant now
    ) {
        return new Project(
                id,
                name,
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
                "Session " + id,
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
                0,
                null,
                null,
                null,
                now,
                now
        );
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @ComponentScan("io.yakable.dao")
    static class TestApplication {
    }
}
