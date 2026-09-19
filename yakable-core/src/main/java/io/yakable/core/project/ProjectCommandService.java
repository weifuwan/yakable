package io.yakable.core.project;

import io.yakable.core.session.Session;
import io.yakable.core.session.SessionService;
import io.yakable.core.session.TurnStartResult;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class ProjectCommandService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;

    private final ProjectRepository projectRepository;
    private final SessionService sessionService;

    public ProjectCommandService(
            ProjectRepository projectRepository,
            SessionService sessionService
    ) {
        this.projectRepository = Objects.requireNonNull(projectRepository, "projectRepository");
        this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
    }

    public ProjectStartResult startProject(StartProjectCommand command) {
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

        Session session = sessionService.createSession(
                project.id(),
                projectName,
                command.provider(),
                command.model()
        );
        TurnStartResult initialTurn = sessionService.startTurn(
                session.id(),
                command.prompt()
        );

        return new ProjectStartResult(project, session, initialTurn);
    }

    private static String projectName(String prompt) {
        String firstLine = prompt.lines()
                .findFirst()
                .orElse(prompt)
                .strip();

        if (firstLine.length() <= MAX_PROJECT_NAME_LENGTH) {
            return firstLine;
        }

        return firstLine.substring(0, MAX_PROJECT_NAME_LENGTH - 3) + "...";
    }
}
