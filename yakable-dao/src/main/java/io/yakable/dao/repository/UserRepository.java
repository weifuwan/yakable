package io.yakable.dao.repository;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.user.QueryUserPageDTO;
import io.yakable.common.enums.user.UserStatusEnum;
import io.yakable.dao.entity.UserEntity;

import java.time.LocalDateTime;
import java.util.List;

/**
 * User 数据访问入口。
 */
public interface UserRepository extends BaseRepository<UserEntity> {

    /**
     * 按用户名查询 User。
     */
    UserEntity queryUserByUsername(String username);

    /**
     * 分页查询 User。
     */
    PageData<UserEntity> queryUser(QueryUserPageDTO dto);

    /**
     * 查询并锁定 ACTIVE ADMIN。
     */
    List<UserEntity> queryActiveAdminForUpdate();

    /**
     * 按当前状态条件更新用户状态。
     */
    int updateUserStatus(
            String userId,
            UserStatusEnum currentStatus,
            UserStatusEnum targetStatus,
            LocalDateTime updateTime,
            String updateBy);
}
