package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 用户登录Session表
 */
@Getter
@Setter
@TableName("yak_auth_session")
public class AuthSessionEntity extends BaseEntity {

    /**
     * 用户ID
     */
    private String userId;

    /**
     * Session Token Hash
     */
    private String tokenHash;

    /**
     * 过期时间
     */
    private LocalDateTime expiresAt;

    /**
     * 撤销时间
     */
    private LocalDateTime revokedAt;
}
