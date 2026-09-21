package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.user.UserRoleEnum;
import io.yakable.common.enums.user.UserStatusEnum;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 用户表
 */
@Getter
@Setter
@TableName("yak_user")
public class UserEntity extends BaseEntity {

    /**
     * 用户名
     */
    private String username;

    /**
     * 用户名称
     */
    private String name;

    /**
     * 用户邮箱
     */
    private String email;

    /**
     * 密码Hash
     */
    private String passwordHash;

    /**
     * 头像地址
     */
    private String avatar;

    /**
     * 用户角色：0-管理员，1-普通用户
     */
    private UserRoleEnum role;

    /**
     * 用户状态：0-正常，1-禁用
     */
    private UserStatusEnum status;

    /**
     * 最近登录时间
     */
    private LocalDateTime lastLoginAt;
}
