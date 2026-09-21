package io.yakable.common.bean.vo.auth;

import io.yakable.common.bean.vo.user.CurrentUserVO;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 用户登录结果。
 */
@Getter
@Setter
public class LoginVO {

    private CurrentUserVO user;

    private String sessionToken;

    private LocalDateTime expiresAt;
}
