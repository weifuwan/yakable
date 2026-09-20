package io.yakable.dao.repository;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.PageDTO;
import io.yakable.dao.entity.BaseEntity;

import java.util.List;
import java.util.Optional;

/**
 * Repository 通用基础能力。
 */
public interface BaseRepository<T extends BaseEntity> {

    /**
     * 新增数据。
     */
    T add(T entity);

    /**
     * 根据 ID 删除数据。
     */
    int deleteById(String id);

    /**
     * 更新数据。
     */
    T update(T entity);

    /**
     * 根据 ID 查询数据。
     */
    Optional<T> queryById(String id);

    /**
     * 查询全部数据。
     */
    List<T> queryList();

    /**
     * 查询数据总数。
     */
    long queryCount();

    /**
     * 简单分页查询。
     */
    PageData<T> queryPage(PageDTO dto);
}
