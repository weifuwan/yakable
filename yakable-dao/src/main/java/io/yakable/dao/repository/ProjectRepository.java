package io.yakable.dao.repository;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.PageDTO;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.mapper.ProjectMapper;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Project 数据访问入口。
 *
 * <p>负责 Project 的新增和查询，屏蔽 Mapper 与 MyBatis-Plus 持久化细节。</p>
 */
@Repository
@DependsOn("yakableFlyway")
public class ProjectRepository {

    @Resource
    private ProjectMapper projectMapper;

    /**
     * 新增 Project。
     */
    public ProjectEntity addProject(ProjectEntity entity) {
        projectMapper.insert(entity);
        return entity;
    }

    /**
     * 分页查询 Project。
     */
    public PageData<ProjectEntity> queryProject(PageDTO dto) {
        Page<ProjectEntity> page = new Page<>(dto.getCurrent(), dto.getPageSize());
        IPage<ProjectEntity> result = projectMapper.selectProjectPage(page);
        return new PageData<>(
                result.getRecords(),
                result.getTotal(),
                result.getPages(),
                Math.toIntExact(result.getCurrent()),
                Math.toIntExact(result.getSize()));
    }

    /**
     * 查询 Project 详情。
     */
    public Optional<ProjectEntity> queryProject(String projectId) {
        return Optional.ofNullable(projectMapper.selectProjectDetails(projectId));
    }
}
