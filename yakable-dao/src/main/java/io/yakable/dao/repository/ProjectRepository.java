package io.yakable.dao.repository;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.PageDTO;
import io.yakable.dao.entity.ProjectEntity;

import java.util.Optional;

/**
 * Project 数据访问入口。
 */
public interface ProjectRepository extends BaseRepository<ProjectEntity> {

    /**
     * 分页查询 Project，并关联最新 Session。
     */
    PageData<ProjectEntity> queryProject(PageDTO dto);

    /**
     * 查询 Project 详情，并关联最新 Session。
     */
    Optional<ProjectEntity> queryProject(String projectId);
}
