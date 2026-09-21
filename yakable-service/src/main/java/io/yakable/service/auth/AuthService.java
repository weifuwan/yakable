package io.yakable.service.auth;

import io.yakable.common.bean.dto.auth.AuthTokenDTO;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.vo.auth.LoginVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * Auth 业务服务。
 */
public interface AuthService {

    /**
     * 用户登录。
     */
    LoginVO login(@NotNull @Valid LoginDTO dto);

    /**
     * 用户退出登录。
     */
    void logout(@NotNull @Valid AuthTokenDTO dto);

    /**
     * 查询当前登录用户。
     */
    CurrentUserVO queryCurrentUser(@NotNull @Valid AuthTokenDTO dto);
}
