package io.yakable.dao.repository;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.PageDTO;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.mapper.ProjectMapper;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

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

    public PageData<ProjectEntity> queryProject(PageDTO dto) {
        Page<ProjectEntity> page = new Page<>(dto.getCurrent(), dto.getPageSize());
        IPage<ProjectEntity> result = mapper.selectProjectPage(page);
        return new PageData<>(
                result.getRecords(),
                result.getTotal(),
                result.getPages(),
                Math.toIntExact(result.getCurrent()),
                Math.toIntExact(result.getSize()));
    }

    public Optional<ProjectEntity> findProjectDetails(String projectId) {
        return Optional.ofNullable(mapper.selectProjectDetails(projectId));
    }
}
