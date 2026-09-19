package io.yakable.application.project;

import io.yakable.application.query.PageResult;

import java.util.Objects;
import java.util.Optional;

public final class ProjectOverviewQueryService {

    private static final int MAX_PAGE_SIZE = 100;

    private final ProjectQueryRepository queryRepository;

    public ProjectOverviewQueryService(
            ProjectQueryRepository queryRepository
    ) {
        this.queryRepository = Objects.requireNonNull(
                queryRepository,
                "queryRepository"
        );
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
