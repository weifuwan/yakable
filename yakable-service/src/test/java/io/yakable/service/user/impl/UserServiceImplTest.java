package io.yakable.service.user.impl;

import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.user.InitializeAdminDTO;
import io.yakable.common.bean.dto.user.QueryUserDTO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.enums.auth.AuthErrorCode;
import io.yakable.common.enums.user.UserRoleEnum;
import io.yakable.common.enums.user.UserStatusEnum;
import io.yakable.common.exception.AuthException;
import io.yakable.dao.entity.UserEntity;
import io.yakable.dao.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    void shouldAuthenticateActiveUser() {
        UserEntity user = user("user-1", UserStatusEnum.ACTIVE);
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
    }

    @Test
    void shouldRejectDisabledUser() {
        UserEntity user = user("user-1", UserStatusEnum.DISABLED);
        when(userRepository.queryUserByUsername("admin")).thenReturn(user);
        when(passwordEncoder.matches("password123", "hash")).thenReturn(true);

        assertThatThrownBy(() -> userService.authenticateUser(new LoginDTO("admin", "password123")))
                .isInstanceOf(AuthException.class)
                .satisfies(exception ->
                        assertThat(((AuthException) exception).getErrorCode()).isEqualTo(AuthErrorCode.ACCOUNT_DISABLED));
        verify(userRepository, never()).update(user);
    }

    @Test
    void shouldRejectUnavailableCurrentUser() {
        when(userRepository.queryById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.queryActiveUser(new QueryUserDTO("missing")))
                .isInstanceOf(AuthException.class)
                .satisfies(exception ->
                        assertThat(((AuthException) exception).getErrorCode()).isEqualTo(AuthErrorCode.UNAUTHORIZED));
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
        assertThat(user.getName()).isEqualTo("Administrator");
        assertThat(user.getPasswordHash()).isEqualTo("encoded");
        assertThat(user.getRole()).isEqualTo(UserRoleEnum.ADMIN);
        assertThat(user.getStatus()).isEqualTo(UserStatusEnum.ACTIVE);
    }

    @Test
    void shouldNotInitializeAdminWhenUsersExist() {
        when(userRepository.queryCount()).thenReturn(1L);

        userService.initializeAdmin(new InitializeAdminDTO("admin", "Administrator", "password123"));

        verify(userRepository, never()).add(org.mockito.ArgumentMatchers.any(UserEntity.class));
        verify(passwordEncoder, never()).encode(org.mockito.ArgumentMatchers.anyString());
    }

    private static UserEntity user(String id, UserStatusEnum status) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername("admin");
        user.setName("Administrator");
        user.setPasswordHash("hash");
        user.setRole(UserRoleEnum.ADMIN);
        user.setStatus(status);
        return user;
    }
}
