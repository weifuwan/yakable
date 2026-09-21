package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.user.QueryUserPageDTO;
import io.yakable.common.enums.user.UserRoleEnum;
import io.yakable.common.enums.user.UserStatusEnum;
import io.yakable.dao.entity.UserEntity;
import io.yakable.dao.mapper.UserMapper;
import io.yakable.dao.repository.UserRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
@DependsOn("yakableFlyway")
public class UserRepositoryImpl extends BaseRepositoryImpl<UserMapper, UserEntity> implements UserRepository {

    @Resource
    private UserMapper userMapper;

    @Override
    protected UserMapper mapper() {
        return userMapper;
    }

    @Override
    public UserEntity queryUserByUsername(String username) {
        return userMapper.selectOne(Wrappers.<UserEntity>lambdaQuery().eq(UserEntity::getUsername, username));
    }

    @Override
    public PageData<UserEntity> queryUser(QueryUserPageDTO dto) {
        var query = Wrappers.<UserEntity>lambdaQuery();
        String keyword = dto.getKeyword();
        if (keyword != null && !keyword.isBlank()) {
            query.and(wrapper -> wrapper
                    .like(UserEntity::getUsername, keyword)
                    .or()
                    .like(UserEntity::getName, keyword)
                    .or()
                    .like(UserEntity::getEmail, keyword));
        }
        if (dto.getRole() != null) {
            query.eq(UserEntity::getRole, dto.getRole());
        }
        if (dto.getStatus() != null) {
            query.eq(UserEntity::getStatus, dto.getStatus());
        }
        query.orderByDesc(UserEntity::getCreateTime, UserEntity::getId);

        Page<UserEntity> page = new Page<>(dto.getCurrent(), dto.getPageSize());
        IPage<UserEntity> result = userMapper.selectPage(page, query);
        return new PageData<>(
                result.getRecords(),
                result.getTotal(),
                result.getPages(),
                Math.toIntExact(result.getCurrent()),
                Math.toIntExact(result.getSize()));
    }

    @Override
    public List<UserEntity> queryActiveAdminForUpdate() {
        return userMapper.selectList(Wrappers.<UserEntity>lambdaQuery()
                .eq(UserEntity::getRole, UserRoleEnum.ADMIN)
                .eq(UserEntity::getStatus, UserStatusEnum.ACTIVE)
                .last("FOR UPDATE"));
    }

    @Override
    public int updateUserStatus(
            String userId,
            UserStatusEnum currentStatus,
            UserStatusEnum targetStatus,
            LocalDateTime updateTime,
            String updateBy) {
        return userMapper.update(null, Wrappers.<UserEntity>lambdaUpdate()
                .eq(UserEntity::getId, userId)
                .eq(UserEntity::getStatus, currentStatus)
                .set(UserEntity::getStatus, targetStatus)
                .set(UserEntity::getUpdateTime, updateTime)
                .set(UserEntity::getUpdateBy, updateBy));
    }
}
