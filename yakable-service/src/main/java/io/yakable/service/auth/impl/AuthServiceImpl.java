package io.yakable.service.auth.impl;

import io.yakable.common.bean.dto.auth.AddAuthSessionDTO;
import io.yakable.common.bean.dto.auth.AuthTokenDTO;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.user.QueryUserDTO;
import io.yakable.common.bean.vo.auth.AuthSessionVO;
import io.yakable.common.bean.vo.auth.LoginVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.service.auth.AuthService;
import io.yakable.service.auth.AuthSessionService;
import io.yakable.service.user.UserService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class AuthServiceImpl implements AuthService {

    @Resource
    private UserService userService;

    @Resource
    private AuthSessionService authSessionService;

    @Override
    @Transactional
    public LoginVO login(LoginDTO dto) {
        CurrentUserVO user = userService.authenticateUser(dto);
        AuthSessionVO session = authSessionService.addAuthSession(new AddAuthSessionDTO(user.getId()));

        LoginVO result = new LoginVO();
        result.setUser(user);
        result.setSessionToken(session.getSessionToken());
        result.setExpiresAt(session.getExpiresAt());
        return result;
    }

    @Override
    public void logout(AuthTokenDTO dto) {
        authSessionService.revokeAuthSession(dto);
    }

    @Override
    public CurrentUserVO queryCurrentUser(AuthTokenDTO dto) {
        AuthSessionVO session = authSessionService.queryAuthSession(dto);
        return userService.queryActiveUser(new QueryUserDTO(session.getUserId()));
    }
}
