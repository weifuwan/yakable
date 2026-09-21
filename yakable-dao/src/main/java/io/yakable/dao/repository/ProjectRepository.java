package io.yakable.dao.repository;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.dao.entity.ProjectEntity;

/**
 * Project 数据访问入口。
 */
public interface ProjectRepository extends BaseRepository<ProjectEntity> {

    /**
     * 按用户和最近活动时间分页查询 Project。
     */
    PageData<ProjectEntity> queryProject(QueryProjectPageDTO dto);
}
