package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.mapper.ProjectMapper;
import io.yakable.dao.repository.ProjectRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.Optional;

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
    public Optional<ProjectEntity> queryByRequestId(String userId, String requestId) {
        return Optional.ofNullable(projectMapper.selectOne(
                Wrappers.<ProjectEntity>lambdaQuery()
                        .eq(ProjectEntity::getCreateBy, userId)
                        .eq(ProjectEntity::getRequestId, requestId)));
    }

    @Override
    public PageData<ProjectEntity> queryProject(QueryProjectPageDTO dto) {
        Page<ProjectEntity> page = new Page<>(dto.getCurrent(), dto.getPageSize());
        IPage<ProjectEntity> result = projectMapper.selectRecentProjectPage(page, dto.getUserId());
        return new PageData<>(
                result.getRecords(),
                result.getTotal(),
                result.getPages(),
                Math.toIntExact(result.getCurrent()),
                Math.toIntExact(result.getSize()));
    }
}
