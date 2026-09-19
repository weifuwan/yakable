package io.yakable.dao.project;

import io.yakable.application.project.ProjectDetails;
import io.yakable.application.project.ProjectQueryRepository;
import io.yakable.application.project.ProjectSummary;
import io.yakable.application.query.PageResult;
import io.yakable.dao.project.mapper.ProjectMapper;
import io.yakable.dao.project.model.ProjectQueryRow;
import io.yakable.domain.project.ProjectStatus;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
public class ProjectQueryRepositoryAdapter
        implements ProjectQueryRepository {

    private final ProjectMapper mapper;

    public ProjectQueryRepositoryAdapter(ProjectMapper mapper) {
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
                        .map(ProjectQueryRepositoryAdapter::toSummary)
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
        ).map(ProjectQueryRepositoryAdapter::toDetails);
    }

    private static ProjectSummary toSummary(
            ProjectQueryRow row
    ) {
        return new ProjectSummary(
                row.getId(),
                row.getName(),
                row.getLatestSessionId(),
                row.getUpdatedAt()
        );
    }

    private static ProjectDetails toDetails(
            ProjectQueryRow row
    ) {
        return new ProjectDetails(
                row.getId(),
                row.getName(),
                row.getLatestSessionId(),
                ProjectStatus.valueOf(row.getStatus()),
                row.getCreatedAt(),
                row.getUpdatedAt()
        );
    }
}
