package io.yakable.dao.repository;

import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.mapper.ProjectMapper;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class ProjectRepository {

    private final ProjectMapper mapper;

    public ProjectRepository(ProjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public ProjectEntity save(ProjectEntity entity) {
        Objects.requireNonNull(entity, "entity");
        if (mapper.selectById(entity.getId()) == null) {
            mapper.insert(entity);
        } else {
            mapper.updateById(entity);
        }
        return entity;
    }

    public Optional<ProjectEntity> findById(String projectId) {
        return Optional.ofNullable(mapper.selectById(projectId));
    }

    public long countProjectsWithSession() {
        return mapper.countProjectsWithSession();
    }

    public List<ProjectEntity> findProjectPage(long offset, int limit) {
        return mapper.selectProjectPage(offset, limit);
    }

    public Optional<ProjectEntity> findProjectDetails(String projectId) {
        return Optional.ofNullable(mapper.selectProjectDetails(projectId));
    }
}
