package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.common.PageDTO;
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

    @Override
    public PageData<ProjectEntity> queryProject(PageDTO dto) {
        Page<ProjectEntity> page = new Page<>(dto.getCurrent(), dto.getPageSize());
        IPage<ProjectEntity> result = projectMapper.selectPage(
                page,
                Wrappers.<ProjectEntity>lambdaQuery().orderByDesc(ProjectEntity::getUpdateTime, ProjectEntity::getId));
        return new PageData<>(
                result.getRecords(),
                result.getTotal(),
                result.getPages(),
                Math.toIntExact(result.getCurrent()),
                Math.toIntExact(result.getSize()));
    }
}
