package io.yakable.dao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.yakable.dao.entity.ProjectEntity;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ProjectMapper extends BaseMapper<ProjectEntity> {

    long countProjectsWithSession();

    List<ProjectEntity> selectProjectPage(
            @Param("offset") long offset,
            @Param("limit") int limit
    );

    ProjectEntity selectProjectDetails(
            @Param("projectId") String projectId
    );
}
