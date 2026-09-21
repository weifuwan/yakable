package io.yakable.service.user.impl;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.auth.RevokeUserSessionsDTO;
import io.yakable.common.bean.dto.user.*;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.bean.vo.user.UserVO;
import io.yakable.common.enums.auth.AuthErrorCode;
import io.yakable.common.enums.user.UserErrorCode;
import io.yakable.common.enums.user.UserRoleEnum;
import io.yakable.common.enums.user.UserStatusEnum;
import io.yakable.common.exception.AuthException;
import io.yakable.common.exception.UserException;
import io.yakable.dao.entity.UserEntity;
import io.yakable.dao.repository.UserRepository;
import io.yakable.service.auth.AuthSessionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuthSessionService authSessionService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    void shouldAuthenticateActiveUser() {
        UserEntity user = user("user-1", UserRoleEnum.ADMIN, UserStatusEnum.ACTIVE);
        when(userRepository.queryUserByUsername("admin")).thenReturn(user);
        when(passwordEncoder.matches("password123", "hash")).thenReturn(true);

        CurrentUserVO result = userService.authenticateUser(new LoginDTO("admin", "password123"));

        assertThat(result.getId()).isEqualTo("user-1");
        assertThat(result.getRole()).isEqualTo("ADMIN");
        assertThat(user.getLastLoginAt()).isNotNull();
        verify(userRepository).update(user);
    }

    @Test
    void shouldRejectInvalidCredentialsWithoutRevealingMissingUser() {
        when(userRepository.queryUserByUsername("missing")).thenReturn(null);

        assertThatThrownBy(() -> userService.authenticateUser(new LoginDTO("missing", "password123")))
                .isInstanceOf(AuthException.class)
                .satisfies(exception ->
                        assertThat(((AuthException) exception).getErrorCode()).isEqualTo(AuthErrorCode.INVALID_CREDENTIALS));
        verify(passwordEncoder).matches(eq("password123"), startsWith("$2y$10$"));
    }

    @Test
    void shouldRejectDisabledUser() {
        UserEntity user = user("user-1", UserRoleEnum.ADMIN, UserStatusEnum.DISABLED);
        when(userRepository.queryUserByUsername("admin")).thenReturn(user);
        when(passwordEncoder.matches("password123", "hash")).thenReturn(true);

        assertThatThrownBy(() -> userService.authenticateUser(new LoginDTO("admin", "password123")))
                .isInstanceOf(AuthException.class)
                .satisfies(exception ->
                        assertThat(((AuthException) exception).getErrorCode()).isEqualTo(AuthErrorCode.ACCOUNT_DISABLED));
        verify(userRepository, never()).update(user);
    }

    @Test
    void shouldAllowReenabledUserToAuthenticateWithExistingPassword() {
        UserEntity target = user("user-1", UserRoleEnum.USER, UserStatusEnum.DISABLED);
        when(userRepository.queryById("user-1")).thenReturn(Optional.of(target));
        when(userRepository.updateUserStatus(
                eq("user-1"), eq(UserStatusEnum.DISABLED), eq(UserStatusEnum.ACTIVE), any(LocalDateTime.class), eq("admin-1")))
                .thenReturn(1);

        UpdateUserStatusDTO status = new UpdateUserStatusDTO();
        status.setUserId("user-1");
        status.setOperatorId("admin-1");
        status.setStatus(UserStatusEnum.ACTIVE);
        userService.updateUserStatus(status);

        when(userRepository.queryUserByUsername("user")).thenReturn(target);
        when(passwordEncoder.matches("password123", "hash")).thenReturn(true);

        CurrentUserVO result = userService.authenticateUser(new LoginDTO("user", "password123"));

        assertThat(target.getStatus()).isEqualTo(UserStatusEnum.ACTIVE);
        assertThat(result.getId()).isEqualTo("user-1");
    }

    @Test
    void shouldQueryUsersAndMapPersistenceFields() {
        QueryUserPageDTO dto = new QueryUserPageDTO();
        UserEntity entity = user("user-1", UserRoleEnum.USER, UserStatusEnum.ACTIVE);
        entity.setCreateTime(LocalDateTime.of(2026, 9, 21, 10, 0));
        entity.setUpdateTime(LocalDateTime.of(2026, 9, 21, 11, 0));
        when(userRepository.queryUser(dto)).thenReturn(new PageData<>(List.of(entity), 1, 1, 1, 20));

        PageData<UserVO> result = userService.queryUser(dto);

        assertThat(result.records()).hasSize(1);
        assertThat(result.records().getFirst().getId()).isEqualTo("user-1");
        assertThat(result.records().getFirst().getRole()).isEqualTo("USER");
        assertThat(result.records().getFirst().getCreatedAt()).isEqualTo(entity.getCreateTime());
    }

    @Test
    void shouldCreateActiveUserWithDefaultRole() {
        AddUserDTO dto = new AddUserDTO();
        dto.setOperatorId("admin-1");
        dto.setUsername("alice");
        dto.setName("Alice");
        dto.setPassword("password123");
        when(passwordEncoder.encode("password123")).thenReturn("encoded");

        UserVO result = userService.addUser(dto);

        ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).add(captor.capture());
        UserEntity saved = captor.getValue();
        assertThat(saved.getUsername()).isEqualTo("alice");
        assertThat(saved.getPasswordHash()).isEqualTo("encoded");
        assertThat(saved.getRole()).isEqualTo(UserRoleEnum.USER);
        assertThat(saved.getStatus()).isEqualTo(UserStatusEnum.ACTIVE);
        assertThat(saved.getCreateBy()).isEqualTo("admin-1");
        assertThat(result.getUsername()).isEqualTo("alice");
    }

    @Test
    void shouldRejectDuplicateUsernameBeforeCreate() {
        AddUserDTO dto = new AddUserDTO();
        dto.setOperatorId("admin-1");
        dto.setUsername("alice");
        dto.setName("Alice");
        dto.setPassword("password123");
        when(userRepository.queryUserByUsername("alice"))
                .thenReturn(user("existing", UserRoleEnum.USER, UserStatusEnum.ACTIVE));

        assertThatThrownBy(() -> userService.addUser(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.USERNAME_EXISTS));
        verify(userRepository, never()).add(any(UserEntity.class));
    }

    @Test
    void shouldPreventAdminFromDemotingSelf() {
        UserEntity admin = user("admin-1", UserRoleEnum.ADMIN, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("admin-1")).thenReturn(Optional.of(admin));
        UpdateUserDTO dto = updateUser("admin-1", "admin-1", UserRoleEnum.USER);

        assertThatThrownBy(() -> userService.updateUser(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.CANNOT_OPERATE_SELF));
    }

    @Test
    void shouldProtectLastActiveAdminFromDemotion() {
        UserEntity admin = user("admin-2", UserRoleEnum.ADMIN, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("admin-2")).thenReturn(Optional.of(admin));
        when(userRepository.queryActiveAdminForUpdate()).thenReturn(List.of(admin));
        UpdateUserDTO dto = updateUser("admin-2", "admin-1", UserRoleEnum.USER);

        assertThatThrownBy(() -> userService.updateUser(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.LAST_ACTIVE_ADMIN));
    }

    @Test
    void shouldDisableUserAndRevokeAllSessions() {
        UserEntity target = user("user-1", UserRoleEnum.USER, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("user-1")).thenReturn(Optional.of(target));
        UpdateUserStatusDTO dto = new UpdateUserStatusDTO();
        dto.setUserId("user-1");
        dto.setOperatorId("admin-1");
        dto.setStatus(UserStatusEnum.DISABLED);

        when(userRepository.updateUserStatus(
                eq("user-1"), eq(UserStatusEnum.ACTIVE), eq(UserStatusEnum.DISABLED), any(LocalDateTime.class), eq("admin-1")))
                .thenReturn(1);

        userService.updateUserStatus(dto);

        assertThat(target.getStatus()).isEqualTo(UserStatusEnum.DISABLED);
        verify(userRepository).updateUserStatus(
                eq("user-1"), eq(UserStatusEnum.ACTIVE), eq(UserStatusEnum.DISABLED), any(LocalDateTime.class), eq("admin-1"));
        ArgumentCaptor<RevokeUserSessionsDTO> captor = ArgumentCaptor.forClass(RevokeUserSessionsDTO.class);
        verify(authSessionService).revokeUserSessions(captor.capture());
        assertThat(captor.getValue().userId()).isEqualTo("user-1");
        assertThat(captor.getValue().operatorId()).isEqualTo("admin-1");
    }

    @Test
    void shouldRejectStaleUserStatusChangeWithoutRevokingSessions() {
        UserEntity target = user("user-1", UserRoleEnum.USER, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("user-1")).thenReturn(Optional.of(target));
        when(userRepository.updateUserStatus(
                eq("user-1"), eq(UserStatusEnum.ACTIVE), eq(UserStatusEnum.DISABLED), any(LocalDateTime.class), eq("admin-1")))
                .thenReturn(0);
        UpdateUserStatusDTO dto = new UpdateUserStatusDTO();
        dto.setUserId("user-1");
        dto.setOperatorId("admin-1");
        dto.setStatus(UserStatusEnum.DISABLED);

        assertThatThrownBy(() -> userService.updateUserStatus(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.STATUS_CHANGED));
        verify(authSessionService, never()).revokeUserSessions(any());
    }

    @Test
    void shouldPreventAdminFromDisablingSelf() {
        UserEntity admin = user("admin-1", UserRoleEnum.ADMIN, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("admin-1")).thenReturn(Optional.of(admin));
        UpdateUserStatusDTO dto = new UpdateUserStatusDTO();
        dto.setUserId("admin-1");
        dto.setOperatorId("admin-1");
        dto.setStatus(UserStatusEnum.DISABLED);

        assertThatThrownBy(() -> userService.updateUserStatus(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.CANNOT_OPERATE_SELF));
        verify(authSessionService, never()).revokeUserSessions(any());
    }

    @Test
    void shouldProtectLastActiveAdminFromDisable() {
        UserEntity admin = user("admin-2", UserRoleEnum.ADMIN, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("admin-2")).thenReturn(Optional.of(admin));
        when(userRepository.queryActiveAdminForUpdate()).thenReturn(List.of(admin));
        UpdateUserStatusDTO dto = new UpdateUserStatusDTO();
        dto.setUserId("admin-2");
        dto.setOperatorId("admin-1");
        dto.setStatus(UserStatusEnum.DISABLED);

        assertThatThrownBy(() -> userService.updateUserStatus(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.LAST_ACTIVE_ADMIN));
    }

    @Test
    void shouldResetOtherUserPasswordAndRevokeSessions() {
        UserEntity target = user("user-1", UserRoleEnum.USER, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("user-1")).thenReturn(Optional.of(target));
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");
        ResetUserPasswordDTO dto = resetPassword("user-1", "admin-1", "new-password", "new-password");

        userService.resetUserPassword(dto);

        assertThat(target.getPasswordHash()).isEqualTo("new-hash");
        verify(userRepository).update(target);
        verify(authSessionService).revokeUserSessions(new RevokeUserSessionsDTO("user-1", "admin-1"));
    }

    @Test
    void shouldPreventAdminFromResettingOwnPasswordWithoutCurrentPassword() {
        ResetUserPasswordDTO dto = resetPassword("admin-1", "admin-1", "new-password", "new-password");

        assertThatThrownBy(() -> userService.resetUserPassword(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.CANNOT_OPERATE_SELF));
    }

    @Test
    void shouldRejectWrongCurrentPassword() {
        UserEntity target = user("user-1", UserRoleEnum.USER, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("user-1")).thenReturn(Optional.of(target));
        when(passwordEncoder.matches("wrong-password", "hash")).thenReturn(false);
        UpdateCurrentUserPasswordDTO dto = currentPassword(
                "user-1", "wrong-password", "new-password", "new-password");

        assertThatThrownBy(() -> userService.updateCurrentUserPassword(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.CURRENT_PASSWORD_INCORRECT));
        verify(authSessionService, never()).revokeUserSessions(any());
    }

    @Test
    void shouldRejectPasswordConfirmationMismatch() {
        UpdateCurrentUserPasswordDTO dto = currentPassword(
                "user-1", "password123", "new-password", "different-password");

        assertThatThrownBy(() -> userService.updateCurrentUserPassword(dto))
                .isInstanceOf(UserException.class)
                .satisfies(exception ->
                        assertThat(((UserException) exception).getErrorCode()).isEqualTo(UserErrorCode.PASSWORD_CONFIRMATION_MISMATCH));
        verify(userRepository, never()).queryById(anyString());
    }

    @Test
    void shouldChangeCurrentPasswordAndRevokeSessions() {
        UserEntity target = user("user-1", UserRoleEnum.USER, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("user-1")).thenReturn(Optional.of(target));
        when(passwordEncoder.matches("password123", "hash")).thenReturn(true);
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");
        UpdateCurrentUserPasswordDTO dto = currentPassword(
                "user-1", "password123", "new-password", "new-password");

        userService.updateCurrentUserPassword(dto);

        assertThat(target.getPasswordHash()).isEqualTo("new-hash");
        verify(authSessionService).revokeUserSessions(new RevokeUserSessionsDTO("user-1", "user-1"));
    }

    @Test
    void shouldUpdateCurrentUserProfileWithoutChangingRoleOrStatus() {
        UserEntity target = user("user-1", UserRoleEnum.USER, UserStatusEnum.ACTIVE);
        when(userRepository.queryById("user-1")).thenReturn(Optional.of(target));
        UpdateCurrentUserDTO dto = new UpdateCurrentUserDTO();
        dto.setUserId("user-1");
        dto.setName("New Name");
        dto.setEmail("new@example.com");
        dto.setAvatar("avatar.png");

        CurrentUserVO result = userService.updateCurrentUser(dto);

        assertThat(target.getName()).isEqualTo("New Name");
        assertThat(target.getEmail()).isEqualTo("new@example.com");
        assertThat(target.getRole()).isEqualTo(UserRoleEnum.USER);
        assertThat(target.getStatus()).isEqualTo(UserStatusEnum.ACTIVE);
        assertThat(result.getName()).isEqualTo("New Name");
    }

    @Test
    void shouldInitializeFirstAdmin() {
        when(userRepository.queryCount()).thenReturn(0L);
        when(passwordEncoder.encode("password123")).thenReturn("encoded");

        userService.initializeAdmin(new InitializeAdminDTO("admin", "Administrator", "password123"));

        ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).add(captor.capture());
        UserEntity user = captor.getValue();
        assertThat(user.getUsername()).isEqualTo("admin");
        assertThat(user.getPasswordHash()).isEqualTo("encoded");
        assertThat(user.getRole()).isEqualTo(UserRoleEnum.ADMIN);
        assertThat(user.getStatus()).isEqualTo(UserStatusEnum.ACTIVE);
    }

    @Test
    void shouldNotInitializeAdminWhenUsersExist() {
        when(userRepository.queryCount()).thenReturn(1L);

        userService.initializeAdmin(new InitializeAdminDTO("admin", "Administrator", "password123"));

        verify(userRepository, never()).add(any(UserEntity.class));
        verify(passwordEncoder, never()).encode(anyString());
    }

    private static UserEntity user(String id, UserRoleEnum role, UserStatusEnum status) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(id.startsWith("admin") ? "admin" : "user");
        user.setName("User");
        user.setPasswordHash("hash");
        user.setRole(role);
        user.setStatus(status);
        return user;
    }

    private static UpdateUserDTO updateUser(String userId, String operatorId, UserRoleEnum role) {
        UpdateUserDTO dto = new UpdateUserDTO();
        dto.setUserId(userId);
        dto.setOperatorId(operatorId);
        dto.setName("Updated");
        dto.setRole(role);
        return dto;
    }

    private static ResetUserPasswordDTO resetPassword(
            String userId, String operatorId, String password, String confirmation) {
        ResetUserPasswordDTO dto = new ResetUserPasswordDTO();
        dto.setUserId(userId);
        dto.setOperatorId(operatorId);
        dto.setNewPassword(password);
        dto.setConfirmPassword(confirmation);
        return dto;
    }

    private static UpdateCurrentUserPasswordDTO currentPassword(
            String userId, String current, String password, String confirmation) {
        UpdateCurrentUserPasswordDTO dto = new UpdateCurrentUserPasswordDTO();
        dto.setUserId(userId);
        dto.setCurrentPassword(current);
        dto.setNewPassword(password);
        dto.setConfirmPassword(confirmation);
        return dto;
    }
}
