package io.yakable.service.auth;

import io.yakable.common.bean.dto.auth.AddAuthSessionDTO;
import io.yakable.common.bean.dto.auth.AuthTokenDTO;
import io.yakable.common.bean.dto.auth.RevokeUserSessionsDTO;
import io.yakable.common.bean.vo.auth.AuthSessionVO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * 登录 Session 业务服务。
 */
public interface AuthSessionService {

    /**
     * 创建登录 Session。
     */
    AuthSessionVO addAuthSession(@NotNull @Valid AddAuthSessionDTO dto);

    /**
     * 查询有效登录 Session。
     */
    AuthSessionVO queryAuthSession(@NotNull @Valid AuthTokenDTO dto);

    /**
     * 撤销指定登录 Session。
     */
    void revokeAuthSession(@NotNull @Valid AuthTokenDTO dto);

    /**
     * 撤销用户全部登录 Session。
     */
    void revokeUserSessions(@NotNull @Valid RevokeUserSessionsDTO dto);
}
