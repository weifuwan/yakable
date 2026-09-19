package io.yakable.application.project;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.session.SessionCommandService;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.project.Project;
import io.yakable.domain.project.ProjectStatus;
import io.yakable.domain.project.repository.ProjectRepository;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.TurnStartResult;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class ProjectBootstrapService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;

    private final ProjectRepository projectRepository;
    private final SessionCommandService sessionCommandService;
    private final TurnDispatcher turnDispatcher;
    private final TransactionRunner transactionRunner;

    public ProjectBootstrapService(
            ProjectRepository projectRepository,
            SessionCommandService sessionCommandService,
            TurnDispatcher turnDispatcher,
            TransactionRunner transactionRunner
    ) {
        this.projectRepository = Objects.requireNonNull(
                projectRepository,
                "projectRepository"
        );
        this.sessionCommandService = Objects.requireNonNull(
                sessionCommandService,
                "sessionCommandService"
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

        Session session = sessionCommandService.createSession(
                project.id(),
                projectName,
                command.provider(),
                command.model()
        );

        TurnStartResult initialTurn =
                sessionCommandService.startTurn(
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
}
