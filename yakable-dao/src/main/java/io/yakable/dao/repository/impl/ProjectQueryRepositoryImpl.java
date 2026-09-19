package io.yakable.dao.repository.impl;

import io.yakable.application.project.ProjectDetails;
import io.yakable.application.project.ProjectQueryRepository;
import io.yakable.application.project.ProjectSummary;
import io.yakable.application.query.PageResult;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.mapper.ProjectMapper;
import io.yakable.domain.project.ProjectStatus;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class ProjectQueryRepositoryImpl
        implements ProjectQueryRepository {

    private final ProjectMapper mapper;

    public ProjectQueryRepositoryImpl(ProjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<ProjectSummary> findProjectSummaries(
            int current,
            int pageSize
    ) {
        long total = mapper.countProjectsWithSession();
        long offset = (long) (current - 1) * pageSize;

        List<ProjectSummary> records =
                mapper.selectProjectPage(offset, pageSize)
                        .stream()
                        .map(ProjectQueryRepositoryImpl::toSummary)
                        .toList();

        return new PageResult<>(
                records,
                total,
                PageResult.pages(total, pageSize),
                current,
                pageSize
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ProjectDetails> findProjectDetails(
            String projectId
    ) {
        return Optional.ofNullable(
                mapper.selectProjectDetails(projectId)
        ).map(ProjectQueryRepositoryImpl::toDetails);
    }

    private static ProjectSummary toSummary(
            ProjectEntity entity
    ) {
        return new ProjectSummary(
                entity.getId(),
                entity.getName(),
                entity.getLatestSessionId(),
                entity.getUpdatedAt()
        );
    }

    private static ProjectDetails toDetails(
            ProjectEntity entity
    ) {
        return new ProjectDetails(
                entity.getId(),
                entity.getName(),
                entity.getLatestSessionId(),
                ProjectStatus.valueOf(entity.getStatus()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
