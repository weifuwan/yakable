package io.yakable.dao.repository;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.dao.entity.BaseEntity;

import java.util.List;
import java.util.Optional;

/**
 * Repository 通用基础能力。
 *
 * <p>只封装 DAO 内部可复用的 MyBatis-Plus 基础操作，不向 Service 暴露。</p>
 */
public abstract class BaseRepository<M extends BaseMapper<T>, T extends BaseEntity> {

    protected abstract M mapper();

    protected T add(T entity) {
        mapper().insert(entity);
        return entity;
    }

    protected int deleteById(String id) {
        return mapper().deleteById(id);
    }

    protected T update(T entity) {
        mapper().updateById(entity);
        return entity;
    }

    protected Optional<T> queryById(String id) {
        return Optional.ofNullable(mapper().selectById(id));
    }

    protected List<T> queryList() {
        return mapper().selectList(null);
    }

    protected List<T> queryList(Wrapper<T> wrapper) {
        return mapper().selectList(wrapper);
    }

    protected long queryCount() {
        return mapper().selectCount(null);
    }

    protected long queryCount(Wrapper<T> wrapper) {
        return mapper().selectCount(wrapper);
    }

    protected IPage<T> queryPage(Page<T> page) {
        return mapper().selectPage(page, null);
    }

    protected IPage<T> queryPage(Page<T> page, Wrapper<T> wrapper) {
        return mapper().selectPage(page, wrapper);
    }
}
