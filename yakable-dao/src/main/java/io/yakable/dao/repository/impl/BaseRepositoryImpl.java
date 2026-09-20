package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.common.PageDTO;
import io.yakable.dao.entity.BaseEntity;
import io.yakable.dao.repository.BaseRepository;

import java.util.List;
import java.util.Optional;

public abstract class BaseRepositoryImpl<M extends BaseMapper<T>, T extends BaseEntity> implements BaseRepository<T> {

    protected abstract M mapper();

    @Override
    public T add(T entity) {
        mapper().insert(entity);
        return entity;
    }

    @Override
    public int deleteById(String id) {
        return mapper().deleteById(id);
    }

    @Override
    public T update(T entity) {
        mapper().updateById(entity);
        return entity;
    }

    @Override
    public Optional<T> queryById(String id) {
        return Optional.ofNullable(mapper().selectById(id));
    }

    @Override
    public List<T> queryList() {
        return mapper().selectList(null);
    }

    @Override
    public long queryCount() {
        return mapper().selectCount(null);
    }

    @Override
    public PageData<T> queryPage(PageDTO dto) {
        Page<T> page = new Page<>(dto.getCurrent(), dto.getPageSize());
        IPage<T> result = mapper().selectPage(page, null);
        return new PageData<>(
                result.getRecords(),
                result.getTotal(),
                result.getPages(),
                Math.toIntExact(result.getCurrent()),
                Math.toIntExact(result.getSize()));
    }
}
