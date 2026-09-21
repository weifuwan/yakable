package io.yakable.boot.controller.auth;

import io.yakable.boot.configuration.exception.GlobalExceptionHandler;
import io.yakable.boot.configuration.security.AuthCookieConstant;
import io.yakable.boot.configuration.security.AuthSessionAuthenticationFilter;
import io.yakable.boot.configuration.security.CsrfCookieFilter;
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
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({
        GlobalExceptionHandler.class,
        SecurityConfiguration.class,
        AuthSessionAuthenticationFilter.class,
        CsrfCookieFilter.class
})
class AuthControllerTest {

    private static final String CSRF_COOKIE = "XSRF-TOKEN";
    private static final String CSRF_HEADER = "X-XSRF-TOKEN";
    private static final String CSRF_TOKEN = "csrf-token";

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

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .cookie(csrfCookie())
                        .header(CSRF_HEADER, CSRF_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "admin",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value("admin"))
                .andReturn();

        assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .anyMatch(value -> value.contains("yakable_session=session-token")
                        && value.contains("HttpOnly")
                        && value.contains("SameSite=Strict"));
    }

    @Test
    void shouldRejectLoginWithoutCsrf() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "admin",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(30004));

        verify(authService, never()).login(any());
    }

    @Test
    void shouldReturnUnauthorizedForInvalidCredentials() throws Exception {
        when(authService.login(any(LoginDTO.class))).thenThrow(new AuthException(AuthErrorCode.INVALID_CREDENTIALS));

        mockMvc.perform(post("/api/auth/login")
                        .cookie(csrfCookie())
                        .header(CSRF_HEADER, CSRF_TOKEN)
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
    void shouldRejectAnonymousCurrentUserRequestAndIssueCsrfCookie() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(30001))
                .andReturn();

        assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .anyMatch(value -> value.startsWith(CSRF_COOKIE + "=")
                        && value.contains("SameSite=Strict"));
    }

    @Test
    void shouldReturnCurrentUserForValidSession() throws Exception {
        when(authService.queryCurrentUser(any())).thenReturn(user());

        mockMvc.perform(get("/api/auth/me")
                        .cookie(sessionCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("user-1"))
                .andExpect(jsonPath("$.data.role").value("ADMIN"));
    }

    @Test
    void shouldLogoutAndClearSessionCookie() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/logout")
                        .cookie(sessionCookie(), csrfCookie())
                        .header(CSRF_HEADER, CSRF_TOKEN))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .anyMatch(value -> value.contains("yakable_session=")
                        && value.contains("Max-Age=0"));
        verify(authService).logout(any());
    }

    private static Cookie sessionCookie() {
        return new Cookie(AuthCookieConstant.SESSION_COOKIE, "session-token");
    }

    private static Cookie csrfCookie() {
        return new Cookie(CSRF_COOKIE, CSRF_TOKEN);
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
