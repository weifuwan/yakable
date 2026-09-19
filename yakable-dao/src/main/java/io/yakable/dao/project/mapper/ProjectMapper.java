package io.yakable.dao.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.yakable.dao.project.model.ProjectPO;
import io.yakable.dao.project.model.ProjectQueryRow;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ProjectMapper extends BaseMapper<ProjectPO> {

    long countProjectsWithSession();

    List<ProjectQueryRow> selectProjectPage(
            @Param("offset") long offset,
            @Param("limit") int limit
    );

    ProjectQueryRow selectProjectDetails(
            @Param("projectId") String projectId
    );
}
