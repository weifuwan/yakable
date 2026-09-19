package io.yakable.dao.project;

import io.yakable.dao.project.mapper.ProjectQueryMapper;
import io.yakable.dao.project.model.ProjectQueryRow;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class MybatisProjectQueryDao
        implements ProjectQueryDao {

    private final ProjectQueryMapper mapper;

    public MybatisProjectQueryDao(ProjectQueryMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    public long countProjects() {
        return mapper.countProjectsWithSession();
    }

    @Override
    public List<ProjectQueryRow> findProjectPage(
            long offset,
            int limit
    ) {
        return mapper.selectProjectPage(offset, limit);
    }

    @Override
    public Optional<ProjectQueryRow> findProjectDetails(
            String projectId
    ) {
        return Optional.ofNullable(
                mapper.selectProjectDetails(projectId)
        );
    }
}
