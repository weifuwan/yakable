package io.yakable.dao.repository.impl;

import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.mapper.ProjectMapper;
import io.yakable.dao.repository.ProjectRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

@Repository
@DependsOn("yakableFlyway")
public class ProjectRepositoryImpl extends BaseRepositoryImpl<ProjectMapper, ProjectEntity> implements ProjectRepository {

    @Resource
    private ProjectMapper projectMapper;

    @Override
    protected ProjectMapper mapper() {
        return projectMapper;
    }
}
