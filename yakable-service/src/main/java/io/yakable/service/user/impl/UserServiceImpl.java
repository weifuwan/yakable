package io.yakable.service.user.impl;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.auth.RevokeUserSessionsDTO;
import io.yakable.common.bean.dto.user.*;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.bean.vo.user.UserVO;
import io.yakable.common.enums.auth.AuthErrorCode;
import io.yakable.common.enums.common.CommonErrorCode;
import io.yakable.common.enums.user.UserErrorCode;
import io.yakable.common.enums.user.UserRoleEnum;
import io.yakable.common.enums.user.UserStatusEnum;
import io.yakable.common.exception.AuthException;
import io.yakable.common.exception.UserException;
import io.yakable.common.utils.DateUtils;
import io.yakable.dao.entity.UserEntity;
import io.yakable.dao.repository.UserRepository;
import io.yakable.service.auth.AuthSessionService;
import io.yakable.service.user.UserService;
import jakarta.annotation.Resource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class UserServiceImpl implements UserService {

    @Resource
    private UserRepository userRepository;

    @Resource
    private AuthSessionService authSessionService;

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
        UserEntity user = requireUser(dto.userId());
        ensureActive(user);
        return toCurrentUser(user);
    }

    @Override
    public PageData<UserVO> queryUser(QueryUserPageDTO dto) {
        return userRepository.queryUser(dto).map(UserServiceImpl::toUser);
    }

    @Override
    @Transactional
    public UserVO addUser(AddUserDTO dto) {
        requireContextId(dto.getOperatorId());
        if (userRepository.queryUserByUsername(dto.getUsername()) != null) {
            throw new UserException(UserErrorCode.USERNAME_EXISTS);
        }

        UserEntity user = new UserEntity();
        user.initCreate(dto.getOperatorId());
        user.setUsername(dto.getUsername());
        user.setName(dto.getName());
        user.setEmail(dto.getEmail());
        user.setAvatar(dto.getAvatar());
        user.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
        user.setRole(dto.getRole() == null ? UserRoleEnum.USER : dto.getRole());
        user.setStatus(UserStatusEnum.ACTIVE);
        try {
            userRepository.add(user);
        } catch (DuplicateKeyException exception) {
            throw new UserException(UserErrorCode.USERNAME_EXISTS, exception);
        }
        return toUser(user);
    }

    @Override
    @Transactional
    public UserVO updateUser(UpdateUserDTO dto) {
        requireOperationContext(dto.getUserId(), dto.getOperatorId());
        UserEntity user = requireUser(dto.getUserId());
        boolean demotingAdmin = user.getRole() == UserRoleEnum.ADMIN && dto.getRole() != UserRoleEnum.ADMIN;
        if (demotingAdmin && user.getId().equals(dto.getOperatorId())) {
            throw new UserException(UserErrorCode.CANNOT_OPERATE_SELF);
        }
        if (demotingAdmin && user.getStatus() == UserStatusEnum.ACTIVE) {
            ensureAnotherActiveAdmin();
        }

        user.setName(dto.getName());
        user.setEmail(dto.getEmail());
        user.setAvatar(dto.getAvatar());
        user.setRole(dto.getRole());
        user.initUpdate(dto.getOperatorId());
        userRepository.update(user);
        return toUser(user);
    }

    @Override
    @Transactional
    public void updateUserStatus(UpdateUserStatusDTO dto) {
        requireOperationContext(dto.getUserId(), dto.getOperatorId());
        UserEntity user = requireUser(dto.getUserId());
        if (user.getStatus() == dto.getStatus()) {
            return;
        }
        if (dto.getStatus() == UserStatusEnum.DISABLED) {
            if (user.getId().equals(dto.getOperatorId())) {
                throw new UserException(UserErrorCode.CANNOT_OPERATE_SELF);
            }
            if (user.getRole() == UserRoleEnum.ADMIN && user.getStatus() == UserStatusEnum.ACTIVE) {
                ensureAnotherActiveAdmin();
            }
        }

        var updateTime = DateUtils.now();
        int updated = userRepository.updateUserStatus(
                user.getId(), user.getStatus(), dto.getStatus(), updateTime, dto.getOperatorId());
        if (updated == 0) {
            throw new UserException(UserErrorCode.STATUS_CHANGED);
        }
        user.setStatus(dto.getStatus());
        user.setUpdateTime(updateTime);
        user.setUpdateBy(dto.getOperatorId());

        if (dto.getStatus() == UserStatusEnum.DISABLED) {
            authSessionService.revokeUserSessions(
                    new RevokeUserSessionsDTO(user.getId(), dto.getOperatorId()));
        }
    }

    @Override
    @Transactional
    public void resetUserPassword(ResetUserPasswordDTO dto) {
        requireOperationContext(dto.getUserId(), dto.getOperatorId());
        if (dto.getUserId().equals(dto.getOperatorId())) {
            throw new UserException(UserErrorCode.CANNOT_OPERATE_SELF);
        }
        ensurePasswordConfirmation(dto.getNewPassword(), dto.getConfirmPassword());

        UserEntity user = requireUser(dto.getUserId());
        user.setPasswordHash(passwordEncoder.encode(dto.getNewPassword()));
        user.initUpdate(dto.getOperatorId());
        userRepository.update(user);
        authSessionService.revokeUserSessions(
                new RevokeUserSessionsDTO(user.getId(), dto.getOperatorId()));
    }

    @Override
    @Transactional
    public CurrentUserVO updateCurrentUser(UpdateCurrentUserDTO dto) {
        requireContextId(dto.getUserId());
        UserEntity user = requireUser(dto.getUserId());
        ensureActive(user);
        user.setName(dto.getName());
        user.setEmail(dto.getEmail());
        user.setAvatar(dto.getAvatar());
        user.initUpdate(user.getId());
        userRepository.update(user);
        return toCurrentUser(user);
    }

    @Override
    @Transactional
    public void updateCurrentUserPassword(UpdateCurrentUserPasswordDTO dto) {
        requireContextId(dto.getUserId());
        ensurePasswordConfirmation(dto.getNewPassword(), dto.getConfirmPassword());

        UserEntity user = requireUser(dto.getUserId());
        ensureActive(user);
        if (!passwordEncoder.matches(dto.getCurrentPassword(), user.getPasswordHash())) {
            throw new UserException(UserErrorCode.CURRENT_PASSWORD_INCORRECT);
        }

        user.setPasswordHash(passwordEncoder.encode(dto.getNewPassword()));
        user.initUpdate(user.getId());
        userRepository.update(user);
        authSessionService.revokeUserSessions(new RevokeUserSessionsDTO(user.getId(), user.getId()));
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

    private UserEntity requireUser(String userId) {
        return userRepository.queryById(userId)
                .orElseThrow(() -> new UserException(UserErrorCode.NOT_FOUND));
    }

    private void ensureAnotherActiveAdmin() {
        if (userRepository.queryActiveAdminForUpdate().size() <= 1) {
            throw new UserException(UserErrorCode.LAST_ACTIVE_ADMIN);
        }
    }

    private static void requireOperationContext(String userId, String operatorId) {
        requireContextId(userId);
        requireContextId(operatorId);
    }

    private static void requireContextId(String value) {
        if (value == null || value.isBlank()) {
            throw new UserException(CommonErrorCode.PARAM_NOT_VALID);
        }
    }

    private static void ensureActive(UserEntity user) {
        if (user.getStatus() != UserStatusEnum.ACTIVE) {
            throw new AuthException(AuthErrorCode.ACCOUNT_DISABLED);
        }
    }

    private static void ensurePasswordConfirmation(String password, String confirmation) {
        if (!password.equals(confirmation)) {
            throw new UserException(UserErrorCode.PASSWORD_CONFIRMATION_MISMATCH);
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

    private static UserVO toUser(UserEntity user) {
        UserVO result = new UserVO();
        result.setId(user.getId());
        result.setUsername(user.getUsername());
        result.setName(user.getName());
        result.setEmail(user.getEmail());
        result.setAvatar(user.getAvatar());
        result.setRole(user.getRole().name());
        result.setStatus(user.getStatus().name());
        result.setLastLoginAt(user.getLastLoginAt());
        result.setCreatedAt(user.getCreateTime());
        result.setUpdatedAt(user.getUpdateTime());
        return result;
    }
}
