package io.yakable.boot.controller.project;

import io.yakable.boot.configuration.exception.GlobalExceptionHandler;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.constant.MessageConstant;
import io.yakable.service.project.ProjectService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProjectService projectService;

    @BeforeEach
    void setCurrentUser() {
        CurrentUserVO user = new CurrentUserVO();
        user.setId("user-1");
        user.setUsername("alice");
        user.setName("Alice");
        user.setRole("USER");
        user.setStatus("ACTIVE");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }

    @AfterEach
    void clearCurrentUser() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldCreateProjectForCurrentUser() throws Exception {
        ProjectListVO project = new ProjectListVO();
        project.setId("project-1");
        project.setName("Build a CRM");
        project.setLatestSessionId("session-1");
        project.setUpdatedAt(LocalDateTime.of(2026, 9, 21, 9, 1));
        when(projectService.addProject(any(AddProjectDTO.class))).thenReturn(project);

        mockMvc.perform(post("/api/projects")
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
                .andExpect(jsonPath("$.data.id").value("project-1"))
                .andExpect(jsonPath("$.data.name").value("Build a CRM"))
                .andExpect(jsonPath("$.data.latestSessionId").value("session-1"))
                .andExpect(jsonPath("$.data.status").doesNotExist())
                .andExpect(jsonPath("$.data.createdAt").doesNotExist());

        ArgumentCaptor<AddProjectDTO> captor = ArgumentCaptor.forClass(AddProjectDTO.class);
        verify(projectService).addProject(captor.capture());
        assertThat(captor.getValue().userId()).isEqualTo("user-1");
        assertThat(captor.getValue().prompt()).isEqualTo("Build a CRM");
        assertThat(captor.getValue().requestId()).isEqualTo("project-request-1");
    }

    @Test
    void shouldQueryProjectListForCurrentUser() throws Exception {
        when(projectService.queryProject(any(QueryProjectPageDTO.class)))
                .thenReturn(new PageData<>(List.<ProjectListVO>of(), 0, 0, 1, 20));

        mockMvc.perform(get("/api/projects")
                        .param("current", "1")
                        .param("pageSize", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        ArgumentCaptor<QueryProjectPageDTO> captor = ArgumentCaptor.forClass(QueryProjectPageDTO.class);
        verify(projectService).queryProject(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo("user-1");
        assertThat(captor.getValue().getCurrent()).isEqualTo(1);
        assertThat(captor.getValue().getPageSize()).isEqualTo(20);
    }

    @Test
    void shouldRejectOversizedProjectPrompt() throws Exception {
        String oversized = "x".repeat(MessageConstant.MAX_CONTENT_LENGTH + 1);

        mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": "%s",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek-flash"
                                  },
                                  "requestId": "project-request-oversized"
                                }
                                """.formatted(oversized)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000));

        verify(projectService, org.mockito.Mockito.never()).addProject(any());
    }

    @Test
    void shouldRejectBlankProjectPrompt() throws Exception {
        mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": " ",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek-flash"
                                  },
                                  "requestId": "project-request-2"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000));
    }
}
