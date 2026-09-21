package io.yakable.boot.controller.project;

import io.yakable.boot.configuration.exception.GlobalExceptionHandler;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.enums.project.ProjectErrorCode;
import io.yakable.common.exception.ProjectException;
import io.yakable.service.project.ProjectService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectController.class)
@Import(GlobalExceptionHandler.class)
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProjectService projectService;

    @Test
    void shouldCreateProjectWithStableHttpContract() throws Exception {
        ProjectDetailVO project = new ProjectDetailVO();
        project.setId("project-1");
        project.setName("Build a CRM");
        project.setLatestSessionId("session-1");
        project.setStatus("CREATED");
        project.setCreatedAt(LocalDateTime.of(2026, 9, 21, 9, 0));
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
                                  }
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("project-1"))
                .andExpect(jsonPath("$.data.latestSessionId").value("session-1"));

        ArgumentCaptor<AddProjectDTO> captor = ArgumentCaptor.forClass(AddProjectDTO.class);
        verify(projectService).addProject(captor.capture());
        assertThat(captor.getValue().prompt()).isEqualTo("Build a CRM");
        assertThat(captor.getValue().model().provider()).isEqualTo("deepseek");
        assertThat(captor.getValue().model().model()).isEqualTo("deepseek-flash");
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
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000));
    }

    @Test
    void shouldMapMissingProjectToNotFound() throws Exception {
        when(projectService.queryProject(any(QueryProjectDTO.class)))
                .thenThrow(new ProjectException(ProjectErrorCode.NOT_FOUND));

        mockMvc.perform(get("/api/projects/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(20001))
                .andExpect(jsonPath("$.message").value("Project not found"));
    }
}
