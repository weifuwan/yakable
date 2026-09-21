package io.yakable.dao.repository;

import io.yakable.dao.entity.UserEntity;

/**
 * User 数据访问入口。
 */
public interface UserRepository extends BaseRepository<UserEntity> {

    /**
     * 按用户名查询 User。
     */
    UserEntity queryUserByUsername(String username);
}
