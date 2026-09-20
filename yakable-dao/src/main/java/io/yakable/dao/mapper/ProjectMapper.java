package io.yakable.dao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.dao.entity.ProjectEntity;
import org.apache.ibatis.annotations.Param;

public interface ProjectMapper extends BaseMapper<ProjectEntity> {

    IPage<ProjectEntity> selectProjectPage(Page<ProjectEntity> page);

    ProjectEntity selectProjectDetails(@Param("projectId") String projectId);
}
