package io.yakable.dao.repository.impl;

import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.mapper.ProjectMapper;
import io.yakable.domain.project.Project;
import io.yakable.domain.project.ProjectStatus;
import io.yakable.domain.project.repository.ProjectRepository;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class ProjectRepositoryImpl implements ProjectRepository {

    private final ProjectMapper mapper;

    public ProjectRepositoryImpl(ProjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    @Transactional
    public Project save(Project project) {
        ProjectEntity entity = toEntity(project);
        if (mapper.selectById(entity.getId()) == null) {
            mapper.insert(entity);
        } else {
            mapper.updateById(entity);
        }
        return project;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Project> findById(String projectId) {
        return Optional.ofNullable(mapper.selectById(projectId))
                .map(ProjectRepositoryImpl::toDomain);
    }

    private static ProjectEntity toEntity(Project project) {
        ProjectEntity entity = new ProjectEntity();
        entity.setId(project.id());
        entity.setName(project.name());
        entity.setStatus(project.status().name());
        entity.setCreatedAt(project.createdAt());
        entity.setUpdatedAt(project.updatedAt());
        return entity;
    }

    private static Project toDomain(ProjectEntity entity) {
        return new Project(
                entity.getId(),
                entity.getName(),
                ProjectStatus.valueOf(entity.getStatus()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
