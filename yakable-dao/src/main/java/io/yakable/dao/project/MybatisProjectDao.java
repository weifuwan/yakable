package io.yakable.dao.project;

import io.yakable.dao.project.mapper.ProjectMapper;
import io.yakable.dao.project.model.ProjectPO;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class MybatisProjectDao implements ProjectDao {

    private final ProjectMapper mapper;

    public MybatisProjectDao(ProjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    public ProjectPO save(ProjectPO project) {
        Objects.requireNonNull(project, "project");
        if (mapper.selectById(project.getId()) == null) {
            mapper.insert(project);
        } else {
            mapper.updateById(project);
        }
        return project;
    }

    @Override
    public Optional<ProjectPO> findById(String projectId) {
        return Optional.ofNullable(mapper.selectById(projectId));
    }
}
