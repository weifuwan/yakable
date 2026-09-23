package io.yakable.boot.configuration.security;

import io.yakable.boot.configuration.exception.GlobalExceptionHandler;
import io.yakable.boot.controller.auth.AuthController;
import io.yakable.boot.controller.project.ProjectController;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.vo.auth.LoginVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.service.auth.AuthService;
import io.yakable.service.project.ProjectService;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {
        AuthController.class,
        ProjectController.class
})
@Import({
        GlobalExceptionHandler.class,
        SecurityConfiguration.class,
        AuthSessionAuthenticationFilter.class,
        CsrfCookieFilter.class
})
class AuthCsrfLifecycleTest {

    private static final String CSRF_COOKIE = "XSRF-TOKEN";
    private static final String CSRF_HEADER = "X-XSRF-TOKEN";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @MockBean
    private ProjectService projectService;

    @Test
    void shouldRefreshCsrfAfterLoginBeforeCreatingProject() throws Exception {
        CurrentUserVO user = user();
        LoginVO login = new LoginVO();
        login.setUser(user);
        login.setSessionToken("session-token");
        login.setExpiresAt(LocalDateTime.now().plusDays(7));

        when(authService.login(any(LoginDTO.class))).thenReturn(login);
        when(authService.queryCurrentUser(any())).thenReturn(user);

        MvcResult anonymousCsrf = mockMvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isString())
                .andReturn();

        Cookie loginCsrfCookie = anonymousCsrf.getResponse().getCookie(CSRF_COOKIE);
        assertThat(loginCsrfCookie).isNotNull();

        mockMvc.perform(post("/api/auth/login")
                        .cookie(loginCsrfCookie)
                        .header(CSRF_HEADER, loginCsrfCookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "admin",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(header -> assertThat(
                        header.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                        .anyMatch(value -> value.contains("yakable_session=session-token")));

        Cookie sessionCookie = new Cookie(AuthCookieConstant.SESSION_COOKIE, "session-token");

        MvcResult authenticatedCsrf = mockMvc.perform(get("/api/auth/csrf")
                        .cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isString())
                .andReturn();

        Cookie projectCsrfCookie = authenticatedCsrf.getResponse().getCookie(CSRF_COOKIE);
        assertThat(projectCsrfCookie).isNotNull();

        ProjectListVO project = new ProjectListVO();
        project.setId("project-1");
        project.setName("Build a CRM");
        project.setLatestSessionId("session-1");
        project.setUpdatedAt(LocalDateTime.of(2026, 9, 23, 10, 0));
        when(projectService.addProject(any(AddProjectDTO.class))).thenReturn(project);

        mockMvc.perform(post("/api/projects")
                        .cookie(sessionCookie, projectCsrfCookie)
                        .header(CSRF_HEADER, projectCsrfCookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": "Build a CRM",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek-flash"
                                  },
                                  "requestId": "project-request-1"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("project-1"));
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
