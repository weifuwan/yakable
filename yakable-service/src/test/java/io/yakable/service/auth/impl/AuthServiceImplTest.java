package io.yakable.service.auth.impl;

import io.yakable.common.bean.dto.auth.AddAuthSessionDTO;
import io.yakable.common.bean.dto.auth.AuthTokenDTO;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.user.QueryUserDTO;
import io.yakable.common.bean.vo.auth.AuthSessionVO;
import io.yakable.common.bean.vo.auth.LoginVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.service.auth.AuthSessionService;
import io.yakable.service.user.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserService userService;

    @Mock
    private AuthSessionService authSessionService;

    @InjectMocks
    private AuthServiceImpl authService;

    @Test
    void shouldLoginAndCreateSession() {
        LoginDTO dto = new LoginDTO("admin", "password123");
        CurrentUserVO user = user();
        AuthSessionVO session = new AuthSessionVO();
        session.setSessionToken("token");
        session.setExpiresAt(LocalDateTime.of(2026, 9, 28, 10, 0));
        when(userService.authenticateUser(dto)).thenReturn(user);
        when(authSessionService.addAuthSession(any(AddAuthSessionDTO.class))).thenReturn(session);

        LoginVO result = authService.login(dto);

        assertThat(result.getUser()).isSameAs(user);
        assertThat(result.getSessionToken()).isEqualTo("token");
        assertThat(result.getExpiresAt()).isEqualTo(session.getExpiresAt());

        ArgumentCaptor<AddAuthSessionDTO> captor = ArgumentCaptor.forClass(AddAuthSessionDTO.class);
        verify(authSessionService).addAuthSession(captor.capture());
        assertThat(captor.getValue().userId()).isEqualTo("user-1");
    }

    @Test
    void shouldResolveCurrentUserFromSession() {
        AuthSessionVO session = new AuthSessionVO();
        session.setUserId("user-1");
        when(authSessionService.queryAuthSession(new AuthTokenDTO("token"))).thenReturn(session);
        when(userService.queryActiveUser(any(QueryUserDTO.class))).thenReturn(user());

        CurrentUserVO result = authService.queryCurrentUser(new AuthTokenDTO("token"));

        assertThat(result.getId()).isEqualTo("user-1");
        ArgumentCaptor<QueryUserDTO> captor = ArgumentCaptor.forClass(QueryUserDTO.class);
        verify(userService).queryActiveUser(captor.capture());
        assertThat(captor.getValue().userId()).isEqualTo("user-1");
    }

    private static CurrentUserVO user() {
        CurrentUserVO user = new CurrentUserVO();
        user.setId("user-1");
        user.setUsername("admin");
        user.setName("Administrator");
        user.setRole("ADMIN");
        user.setStatus("ACTIVE");
        return user;
    }
}
