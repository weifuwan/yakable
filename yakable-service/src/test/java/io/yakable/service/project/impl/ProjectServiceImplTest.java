package io.yakable.service.project.impl;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.common.PageDTO;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.enums.project.ProjectErrorCode;
import io.yakable.common.enums.project.ProjectStatusEnum;
import io.yakable.common.exception.ProjectException;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.repository.ProjectRepository;
import io.yakable.service.session.SessionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceImplTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private SessionService sessionService;

    @Mock
    private TransactionTemplate transactionTemplate;

    @InjectMocks
    private ProjectServiceImpl projectService;

    @Test
    void shouldCreateProjectAndInitialSession() {
        when(transactionTemplate.execute(any(TransactionCallback.class))).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        });

        LocalDateTime sessionUpdatedAt = LocalDateTime.of(2026, 9, 21, 10, 30);
        SessionInitVO session = new SessionInitVO();
        session.setSessionId("session-1");
        session.setTurnId("turn-1");
        session.setUpdatedAt(sessionUpdatedAt);
        when(sessionService.addSession(any(AddSessionDTO.class))).thenReturn(session);

        AddProjectDTO dto = new AddProjectDTO(
                "  Build a CRM dashboard  \nIgnore this second line",
                new AddProjectDTO.ModelDTO("deepseek", "deepseek-flash"));

        ProjectDetailVO result = projectService.addProject(dto);

        ArgumentCaptor<ProjectEntity> projectCaptor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projectRepository).add(projectCaptor.capture());
        ProjectEntity savedProject = projectCaptor.getValue();

        assertThat(savedProject.getName()).isEqualTo("Build a CRM dashboard");
        assertThat(savedProject.getStatus()).isEqualTo(ProjectStatusEnum.CREATED);

        ArgumentCaptor<AddSessionDTO> sessionCaptor = ArgumentCaptor.forClass(AddSessionDTO.class);
        verify(sessionService).addSession(sessionCaptor.capture());
        AddSessionDTO addSession = sessionCaptor.getValue();

        assertThat(addSession.projectId()).isEqualTo(savedProject.getId());
        assertThat(addSession.title()).isEqualTo("Build a CRM dashboard");
        assertThat(addSession.provider()).isEqualTo("deepseek");
        assertThat(addSession.model()).isEqualTo("deepseek-flash");
        assertThat(addSession.content()).isEqualTo(dto.prompt());

        verify(sessionService).executeTurnAsync("turn-1");
        assertThat(result.getId()).isEqualTo(savedProject.getId());
        assertThat(result.getLatestSessionId()).isEqualTo("session-1");
        assertThat(result.getUpdatedAt()).isEqualTo(sessionUpdatedAt);
    }

    @Test
    void shouldReturnLatestSessionTimeWhenItIsNewerThanProject() {
        LocalDateTime projectUpdatedAt = LocalDateTime.of(2026, 9, 21, 9, 0);
        LocalDateTime sessionUpdatedAt = LocalDateTime.of(2026, 9, 21, 10, 0);

        ProjectEntity project = project("project-1", "CRM", projectUpdatedAt);
        SessionVO session = new SessionVO();
        session.setId("session-1");
        session.setProjectId("project-1");
        session.setUpdatedAt(sessionUpdatedAt);

        when(projectRepository.queryProject(any(PageDTO.class)))
                .thenReturn(new PageData<>(List.of(project), 1, 1, 1, 20));
        when(sessionService.queryLatestSessionMap(List.of("project-1")))
                .thenReturn(Map.of("project-1", session));

        PageData<ProjectListVO> result = projectService.queryProject(new PageDTO(1, 20));

        assertThat(result.records()).hasSize(1);
        assertThat(result.records().getFirst().getLatestSessionId()).isEqualTo("session-1");
        assertThat(result.records().getFirst().getUpdatedAt()).isEqualTo(sessionUpdatedAt);
    }

    @Test
    void shouldRejectMissingProject() {
        when(projectRepository.queryById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.queryProject(new QueryProjectDTO("missing")))
                .isInstanceOf(ProjectException.class)
                .satisfies(exception ->
                        assertThat(((ProjectException) exception).getErrorCode()).isEqualTo(ProjectErrorCode.NOT_FOUND));
    }

    private static ProjectEntity project(String id, String name, LocalDateTime updatedAt) {
        ProjectEntity project = new ProjectEntity();
        project.setId(id);
        project.setName(name);
        project.setStatus(ProjectStatusEnum.CREATED);
        project.setCreateTime(updatedAt.minusHours(1));
        project.setUpdateTime(updatedAt);
        return project;
    }
}
