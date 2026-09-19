package io.yakable.service.project;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.project.ProjectDetails;
import io.yakable.application.project.ProjectQueryRepository;
import io.yakable.application.project.ProjectStartResult;
import io.yakable.application.project.ProjectSummary;
import io.yakable.application.project.StartProjectCommand;
import io.yakable.application.query.PageResult;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.project.Project;
import io.yakable.domain.project.ProjectStatus;
import io.yakable.domain.project.repository.ProjectRepository;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.service.session.SessionService;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public final class ProjectService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;
    private static final int MAX_PAGE_SIZE = 100;

    private final ProjectRepository projectRepository;
    private final ProjectQueryRepository queryRepository;
    private final SessionService sessionService;
    private final TurnDispatcher turnDispatcher;
    private final TransactionRunner transactionRunner;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectQueryRepository queryRepository,
            SessionService sessionService,
            TurnDispatcher turnDispatcher,
            TransactionRunner transactionRunner
    ) {
        this.projectRepository = Objects.requireNonNull(
                projectRepository,
                "projectRepository"
        );
        this.queryRepository = Objects.requireNonNull(
                queryRepository,
                "queryRepository"
        );
        this.sessionService = Objects.requireNonNull(
                sessionService,
                "sessionService"
        );
        this.turnDispatcher = Objects.requireNonNull(
                turnDispatcher,
                "turnDispatcher"
        );
        this.transactionRunner = Objects.requireNonNull(
                transactionRunner,
                "transactionRunner"
        );
    }

    public ProjectStartResult startProject(
            StartProjectCommand command
    ) {
        Objects.requireNonNull(command, "command");

        ProjectStartResult result = transactionRunner.required(
                () -> persistProject(command)
        );

        dispatchBestEffort(result.initialTurn().turn().id());
        return result;
    }

    public PageResult<ProjectSummary> listProjects(
            int current,
            int pageSize
    ) {
        if (current <= 0) {
            throw new IllegalArgumentException(
                    "current must be greater than zero"
            );
        }
        if (pageSize <= 0 || pageSize > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException(
                    "pageSize must be between 1 and "
                            + MAX_PAGE_SIZE
            );
        }

        return queryRepository.findProjectSummaries(
                current,
                pageSize
        );
    }

    public Optional<ProjectDetails> getProject(
            String projectId
    ) {
        return queryRepository.findProjectDetails(
                requireText(projectId, "projectId")
        );
    }

    private ProjectStartResult persistProject(
            StartProjectCommand command
    ) {
        Instant now = Instant.now();
        String projectName = projectName(command.prompt());

        Project project = projectRepository.save(new Project(
                UUID.randomUUID().toString(),
                projectName,
                ProjectStatus.CREATED,
                now,
                now
        ));

        Session session = sessionService.createSession(
                project.id(),
                projectName,
                command.provider(),
                command.model()
        );

        TurnStartResult initialTurn =
                sessionService.createPendingTurn(
                        project.id(),
                        session.id(),
                        command.prompt()
                );

        return new ProjectStartResult(
                project,
                session,
                initialTurn
        );
    }

    private void dispatchBestEffort(String turnId) {
        try {
            turnDispatcher.dispatch(turnId);
        } catch (RuntimeException ignored) {
            // PENDING is durable; recovery will retry dispatch.
        }
    }

    private static String projectName(String prompt) {
        String firstLine = prompt.lines()
                .findFirst()
                .orElse(prompt)
                .strip();

        if (firstLine.length() <= MAX_PROJECT_NAME_LENGTH) {
            return firstLine;
        }

        return firstLine.substring(
                0,
                MAX_PROJECT_NAME_LENGTH - 3
        ) + "...";
    }

    private static String requireText(
            String value,
            String field
    ) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    field + " must not be blank"
            );
        }
        return normalized;
    }
}
