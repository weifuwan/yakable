package io.yakable.boot.controller.auth;

import io.yakable.boot.configuration.exception.GlobalExceptionHandler;
import io.yakable.boot.configuration.security.AuthCookieConstant;
import io.yakable.boot.configuration.security.AuthSessionAuthenticationFilter;
import io.yakable.boot.configuration.security.SecurityConfiguration;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.vo.auth.LoginVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.enums.auth.AuthErrorCode;
import io.yakable.common.exception.AuthException;
import io.yakable.service.auth.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({GlobalExceptionHandler.class, SecurityConfiguration.class, AuthSessionAuthenticationFilter.class})
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @Test
    void shouldLoginAndSetHttpOnlySessionCookie() throws Exception {
        LoginVO login = new LoginVO();
        login.setUser(user());
        login.setSessionToken("session-token");
        login.setExpiresAt(LocalDateTime.now().plusDays(7));
        when(authService.login(any(LoginDTO.class))).thenReturn(login);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "admin",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("yakable_session=session-token")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=Strict")))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value("admin"));
    }

    @Test
    void shouldReturnUnauthorizedForInvalidCredentials() throws Exception {
        when(authService.login(any(LoginDTO.class))).thenThrow(new AuthException(AuthErrorCode.INVALID_CREDENTIALS));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "admin",
                                  "password": "wrong-password"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(30002))
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void shouldRejectAnonymousCurrentUserRequest() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(30001));
    }

    @Test
    void shouldReturnCurrentUserForValidSession() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(user());

        mockMvc.perform(get("/api/auth/me")
                        .cookie(new Cookie(AuthCookieConstant.SESSION_COOKIE, "session-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("user-1"))
                .andExpect(jsonPath("$.data.role").value("ADMIN"));
    }

    @Test
    void shouldLogoutAndClearSessionCookie() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie(AuthCookieConstant.SESSION_COOKIE, "session-token")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("yakable_session=")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));

        verify(authService).logout(any());
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
