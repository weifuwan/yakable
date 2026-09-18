package io.yakable.core.project;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class ProjectCommandService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;

    private final ProjectRepository projectRepository;

    public ProjectCommandService(ProjectRepository projectRepository) {
        this.projectRepository = Objects.requireNonNull(projectRepository, "projectRepository");
    }

    public Project createProject(CreateProjectCommand command) {
        Objects.requireNonNull(command, "command");

        Instant now = Instant.now();
        Project project = new Project(
                UUID.randomUUID().toString(),
                projectName(command.prompt()),
                command.prompt(),
                command.provider(),
                command.model(),
                ProjectStatus.CREATED,
                now,
                now
        );

        return projectRepository.save(project);
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
