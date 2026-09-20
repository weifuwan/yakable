package io.yakable.dao.repository;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.common.PageDTO;
import io.yakable.dao.entity.ProjectEntity;

/**
 * Project 数据访问入口。
 */
public interface ProjectRepository extends BaseRepository<ProjectEntity> {

    /**
     * 按更新时间倒序分页查询 Project。
     */
    PageData<ProjectEntity> queryProject(PageDTO dto);
}
