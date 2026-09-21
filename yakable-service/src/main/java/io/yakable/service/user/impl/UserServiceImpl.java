package io.yakable.service.user.impl;

import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.user.InitializeAdminDTO;
import io.yakable.common.bean.dto.user.QueryUserDTO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.enums.auth.AuthErrorCode;
import io.yakable.common.enums.user.UserRoleEnum;
import io.yakable.common.enums.user.UserStatusEnum;
import io.yakable.common.exception.AuthException;
import io.yakable.common.utils.DateUtils;
import io.yakable.dao.entity.UserEntity;
import io.yakable.dao.repository.UserRepository;
import io.yakable.service.user.UserService;
import jakarta.annotation.Resource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class UserServiceImpl implements UserService {

    @Resource
    private UserRepository userRepository;

    @Resource
    private PasswordEncoder passwordEncoder;

    @Override
    public CurrentUserVO authenticateUser(LoginDTO dto) {
        UserEntity user = userRepository.queryUserByUsername(dto.username());
        if (user == null || !passwordEncoder.matches(dto.password(), user.getPasswordHash())) {
            throw new AuthException(AuthErrorCode.INVALID_CREDENTIALS);
        }
        ensureActive(user);
        user.setLastLoginAt(DateUtils.now());
        user.initUpdate(user.getId());
        userRepository.update(user);
        return toCurrentUser(user);
    }

    @Override
    public CurrentUserVO queryActiveUser(QueryUserDTO dto) {
        UserEntity user = userRepository.queryById(dto.userId())
                .orElseThrow(() -> new AuthException(AuthErrorCode.UNAUTHORIZED));
        ensureActive(user);
        return toCurrentUser(user);
    }

    @Override
    public void initializeAdmin(InitializeAdminDTO dto) {
        if (userRepository.queryCount() > 0) {
            return;
        }
        UserEntity user = new UserEntity();
        user.initCreate();
        user.setUsername(dto.username());
        user.setName(dto.name());
        user.setPasswordHash(passwordEncoder.encode(dto.password()));
        user.setRole(UserRoleEnum.ADMIN);
        user.setStatus(UserStatusEnum.ACTIVE);
        userRepository.add(user);
    }

    private static void ensureActive(UserEntity user) {
        if (user.getStatus() != UserStatusEnum.ACTIVE) {
            throw new AuthException(AuthErrorCode.ACCOUNT_DISABLED);
        }
    }

    private static CurrentUserVO toCurrentUser(UserEntity user) {
        CurrentUserVO result = new CurrentUserVO();
        result.setId(user.getId());
        result.setUsername(user.getUsername());
        result.setName(user.getName());
        result.setEmail(user.getEmail());
        result.setAvatar(user.getAvatar());
        result.setRole(user.getRole().name());
        result.setStatus(user.getStatus().name());
        return result;
    }
}
