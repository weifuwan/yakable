package io.yakable.core.application.project;

import io.yakable.core.project.Project;
import io.yakable.core.project.ProjectRepository;
import io.yakable.core.project.ProjectStartResult;
import io.yakable.core.project.ProjectStatus;
import io.yakable.core.project.StartProjectCommand;
import io.yakable.core.session.Session;
import io.yakable.core.session.SessionCommandService;
import io.yakable.core.session.TurnStartResult;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class ProjectBootstrapService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;

    private final ProjectRepository projectRepository;
    private final SessionCommandService sessionCommandService;

    public ProjectBootstrapService(
            ProjectRepository projectRepository,
            SessionCommandService sessionCommandService
    ) {
        this.projectRepository = Objects.requireNonNull(
                projectRepository,
                "projectRepository"
        );
        this.sessionCommandService = Objects.requireNonNull(
                sessionCommandService,
                "sessionCommandService"
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
