package io.yakable.boot.controller.user;

import io.yakable.boot.configuration.exception.GlobalExceptionHandler;
import io.yakable.boot.configuration.security.AuthCookieConstant;
import io.yakable.boot.configuration.security.AuthSessionAuthenticationFilter;
import io.yakable.boot.configuration.security.SecurityConfiguration;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.user.*;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.bean.vo.user.UserVO;
import io.yakable.common.enums.user.UserErrorCode;
import io.yakable.common.exception.UserException;
import io.yakable.service.auth.AuthService;
import io.yakable.service.user.UserService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserController.class)
@Import({GlobalExceptionHandler.class, SecurityConfiguration.class, AuthSessionAuthenticationFilter.class})
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private AuthService authService;

    @Test
    void shouldAllowAdminToQueryUsers() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(currentUser("admin-1", "ADMIN"));
        UserVO user = new UserVO();
        user.setId("user-1");
        user.setUsername("alice");
        user.setRole("USER");
        user.setStatus("ACTIVE");
        when(userService.queryUser(any(QueryUserPageDTO.class)))
                .thenReturn(new PageData<>(List.of(user), 1, 1, 1, 20));

        mockMvc.perform(get("/api/users")
                        .param("keyword", "ali")
                        .cookie(sessionCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.records[0].username").value("alice"));
    }

    @Test
    void shouldRejectNormalUserFromAdminUserManagement() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(currentUser("user-1", "USER"));

        mockMvc.perform(get("/api/users").cookie(sessionCookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(30004));
    }

    @Test
    void shouldCreateUserWithCurrentAdminAsOperator() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(currentUser("admin-1", "ADMIN"));
        UserVO created = new UserVO();
        created.setId("user-1");
        created.setUsername("alice");
        created.setRole("USER");
        created.setStatus("ACTIVE");
        when(userService.addUser(any(AddUserDTO.class))).thenReturn(created);

        mockMvc.perform(post("/api/users")
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "alice",
                                  "name": "Alice",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.username").value("alice"));

        ArgumentCaptor<AddUserDTO> captor = ArgumentCaptor.forClass(AddUserDTO.class);
        verify(userService).addUser(captor.capture());
        assertThat(captor.getValue().getOperatorId()).isEqualTo("admin-1");
        assertThat(captor.getValue().getUsername()).isEqualTo("alice");
    }

    @Test
    void shouldDisableUserWithCurrentAdminAsOperator() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(currentUser("admin-1", "ADMIN"));

        mockMvc.perform(put("/api/users/user-1/status")
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "DISABLED"
                                }
                                """))
                .andExpect(status().isOk());

        ArgumentCaptor<UpdateUserStatusDTO> captor = ArgumentCaptor.forClass(UpdateUserStatusDTO.class);
        verify(userService).updateUserStatus(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo("user-1");
        assertThat(captor.getValue().getOperatorId()).isEqualTo("admin-1");
    }

    @Test
    void shouldAllowNormalUserToUpdateOwnProfile() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(currentUser("user-1", "USER"));
        when(userService.updateCurrentUser(any(UpdateCurrentUserDTO.class)))
                .thenReturn(currentUser("user-1", "USER"));

        mockMvc.perform(put("/api/users/me")
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Alice",
                                  "email": "alice@example.com"
                                }
                                """))
                .andExpect(status().isOk());

        ArgumentCaptor<UpdateCurrentUserDTO> captor = ArgumentCaptor.forClass(UpdateCurrentUserDTO.class);
        verify(userService).updateCurrentUser(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo("user-1");
    }

    @Test
    void shouldAllowNormalUserToChangeOwnPassword() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(currentUser("user-1", "USER"));

        mockMvc.perform(put("/api/users/me/password")
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "password123",
                                  "newPassword": "new-password",
                                  "confirmPassword": "new-password"
                                }
                                """))
                .andExpect(status().isOk());

        ArgumentCaptor<UpdateCurrentUserPasswordDTO> captor =
                ArgumentCaptor.forClass(UpdateCurrentUserPasswordDTO.class);
        verify(userService).updateCurrentUserPassword(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo("user-1");
    }

    @Test
    void shouldMapDuplicateUsernameToConflict() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(currentUser("admin-1", "ADMIN"));
        when(userService.addUser(any(AddUserDTO.class)))
                .thenThrow(new UserException(UserErrorCode.USERNAME_EXISTS));

        mockMvc.perform(post("/api/users")
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "alice",
                                  "name": "Alice",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(40002));
    }

    private static Cookie sessionCookie() {
        return new Cookie(AuthCookieConstant.SESSION_COOKIE, "session-token");
    }

    private static CurrentUserVO currentUser(String id, String role) {
        CurrentUserVO user = new CurrentUserVO();
        user.setId(id);
        user.setUsername(id);
        user.setName(id);
        user.setRole(role);
        user.setStatus("ACTIVE");
        return user;
    }
}
