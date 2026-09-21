package io.yakable.dao.repository;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.dao.entity.ProjectEntity;

import java.util.Optional;

/**
 * Project 数据访问入口。
 */
public interface ProjectRepository extends BaseRepository<ProjectEntity> {

    /**
     * 按用户分页查询 Project。
     */
    PageData<ProjectEntity> queryProject(QueryProjectPageDTO dto);

    /**
     * 按 ID 和所属用户查询 Project。
     */
    Optional<ProjectEntity> queryProject(String projectId, String userId);
}
