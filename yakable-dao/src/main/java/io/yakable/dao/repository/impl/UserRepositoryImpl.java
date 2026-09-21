package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.dao.entity.UserEntity;
import io.yakable.dao.mapper.UserMapper;
import io.yakable.dao.repository.UserRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

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
}
