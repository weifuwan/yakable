package io.yakable.application.project;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.session.SessionCommandService;
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

    public ProjectBootstrapService(
            ProjectRepository projectRepository,
            SessionCommandService sessionCommandService,
            TurnDispatcher turnDispatcher
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
    }

    public ProjectStartResult startProject(
            StartProjectCommand command
    ) {
        Objects.requireNonNull(command, "command");

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

        turnDispatcher.dispatch(initialTurn.turn().id());

        return new ProjectStartResult(
                project,
                session,
                initialTurn
        );
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
