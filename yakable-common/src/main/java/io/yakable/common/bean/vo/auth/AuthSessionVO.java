package io.yakable.common.bean.vo.auth;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 登录 Session 信息。
 */
@Getter
@Setter
public class AuthSessionVO {

    private String userId;

    private String sessionToken;

    private LocalDateTime expiresAt;
}
