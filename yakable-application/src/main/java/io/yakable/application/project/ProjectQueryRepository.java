package io.yakable.application.project;

import io.yakable.application.query.PageResult;

import java.util.Optional;

public interface ProjectQueryRepository {

    PageResult<ProjectSummary> findProjectSummaries(
            int current,
            int pageSize
    );

    Optional<ProjectDetails> findProjectDetails(String projectId);
}
