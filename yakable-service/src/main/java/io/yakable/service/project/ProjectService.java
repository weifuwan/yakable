package io.yakable.service.project;

import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.repository.ProjectRepository;
import io.yakable.service.session.SessionService;
import io.yakable.service.turn.TurnDispatcher;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public final class ProjectService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;
    private static final int MAX_PAGE_SIZE = 100;

    private final ProjectRepository repository;
    private final SessionService sessionService;
    private final TurnDispatcher turnDispatcher;
    private final TransactionTemplate transactionTemplate;

    public ProjectService(
            ProjectRepository repository,
            SessionService sessionService,
            TurnDispatcher turnDispatcher,
            TransactionTemplate transactionTemplate
    ) {
        this.repository = Objects.requireNonNull(
                repository,
                "repository"
        );
        this.sessionService = Objects.requireNonNull(
                sessionService,
                "sessionService"
        );
        this.turnDispatcher = Objects.requireNonNull(
                turnDispatcher,
                "turnDispatcher"
        );
        this.transactionTemplate = Objects.requireNonNull(
                transactionTemplate,
                "transactionTemplate"
        );
    }

    public ProjectDetails createProject(
            String prompt,
            String provider,
            String model
    ) {
        String normalizedPrompt = requireText(prompt, "prompt");
        String normalizedProvider = requireText(provider, "provider");
        String normalizedModel = requireText(model, "model");

        CreatedProject created = transactionTemplate.execute(status -> {
            Instant now = Instant.now();
            String name = projectName(normalizedPrompt);

            ProjectEntity project = new ProjectEntity();
            project.setId(UUID.randomUUID().toString());
            project.setName(name);
            project.setStatus("CREATED");
            project.setCreatedAt(now);
            project.setUpdatedAt(now);
            repository.save(project);

            SessionService.InitialSession session =
                    sessionService.createInitialSession(
                            project.getId(),
                            name,
                            normalizedProvider,
                            normalizedModel,
                            normalizedPrompt
                    );

            return new CreatedProject(project, session);
        });

        if (created == null) {
            throw new IllegalStateException(
                    "Project transaction returned no result"
            );
        }

        turnDispatcher.dispatch(created.session().turnId());

        return new ProjectDetails(
                created.project().getId(),
                created.project().getName(),
                created.session().sessionId(),
                created.project().getStatus(),
                created.project().getCreatedAt(),
                created.session().updatedAt()
        );
    }

    public ProjectPage listProjects(
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

        long total = repository.countProjectsWithSession();
        long offset = (long) (current - 1) * pageSize;

        List<ProjectSummary> records = repository
                .findProjectPage(offset, pageSize)
                .stream()
                .map(ProjectService::toSummary)
                .toList();

        long pages = total == 0
                ? 0
                : (total + pageSize - 1) / pageSize;

        return new ProjectPage(
                records,
                total,
                pages,
                current,
                pageSize
        );
    }

    public Optional<ProjectDetails> getProject(String projectId) {
        return repository.findProjectDetails(
                        requireText(projectId, "projectId")
                )
                .map(ProjectService::toDetails);
    }

    private static ProjectSummary toSummary(ProjectEntity entity) {
        return new ProjectSummary(
                entity.getId(),
                entity.getName(),
                entity.getLatestSessionId(),
                entity.getUpdatedAt()
        );
    }

    private static ProjectDetails toDetails(ProjectEntity entity) {
        return new ProjectDetails(
                entity.getId(),
                entity.getName(),
                entity.getLatestSessionId(),
                entity.getStatus(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static String projectName(String prompt) {
        String firstLine = prompt.lines()
                .findFirst()
                .orElse(prompt)
                .strip();

        return firstLine.length() <= MAX_PROJECT_NAME_LENGTH
                ? firstLine
                : firstLine.substring(
                        0,
                        MAX_PROJECT_NAME_LENGTH - 3
                ) + "...";
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    field + " must not be blank"
            );
        }
        return normalized;
    }

    private record CreatedProject(
            ProjectEntity project,
            SessionService.InitialSession session
    ) {
    }

    public record ProjectPage(
            List<ProjectSummary> records,
            long total,
            long pages,
            int current,
            int pageSize
    ) {
    }

    public record ProjectSummary(
            String id,
            String name,
            String latestSessionId,
            Instant updatedAt
    ) {
    }

    public record ProjectDetails(
            String id,
            String name,
            String latestSessionId,
            String status,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
