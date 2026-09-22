package io.yakable.service.project.impl;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionVO;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
    void shouldCreateProjectAndInitialSessionForCurrentUser() {
        doAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        }).when(transactionTemplate).execute(any(TransactionCallback.class));

        LocalDateTime sessionUpdatedAt = LocalDateTime.of(2026, 9, 21, 10, 30);
        SessionInitVO session = new SessionInitVO();
        session.setSessionId("session-1");
        session.setTurnId("turn-1");
        session.setUpdatedAt(sessionUpdatedAt);
        when(sessionService.addSession(any(AddSessionDTO.class))).thenReturn(session);

        AddProjectDTO dto = new AddProjectDTO(
                "user-1",
                "  Build a CRM dashboard  \nIgnore this second line",
                new AddProjectDTO.ModelDTO("deepseek", "deepseek-flash"),
                "project-request-1");

        ProjectListVO result = projectService.addProject(dto);

        ArgumentCaptor<ProjectEntity> projectCaptor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projectRepository).add(projectCaptor.capture());
        ProjectEntity savedProject = projectCaptor.getValue();

        assertThat(savedProject.getName()).isEqualTo("Build a CRM dashboard");
        assertThat(savedProject.getRequestId()).isEqualTo("project-request-1");
        assertThat(savedProject.getCreateBy()).isEqualTo("user-1");

        ArgumentCaptor<AddSessionDTO> sessionCaptor = ArgumentCaptor.forClass(AddSessionDTO.class);
        verify(sessionService).addSession(sessionCaptor.capture());
        assertThat(sessionCaptor.getValue().userId()).isEqualTo("user-1");
        assertThat(sessionCaptor.getValue().title()).isEqualTo("Build a CRM dashboard");
        assertThat(sessionCaptor.getValue().requestId()).isEqualTo("project-request-1");

        verify(sessionService).executeTurnAsync("turn-1");
        assertThat(result.getId()).isEqualTo(savedProject.getId());
        assertThat(result.getName()).isEqualTo("Build a CRM dashboard");
        assertThat(result.getLatestSessionId()).isEqualTo("session-1");
        assertThat(result.getUpdatedAt()).isEqualTo(sessionUpdatedAt);
    }

    @Test
    void shouldUseFirstNonBlankPromptLineAsProjectName() {
        doAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        }).when(transactionTemplate).execute(any(TransactionCallback.class));

        SessionInitVO session = new SessionInitVO();
        session.setSessionId("session-1");
        session.setTurnId("turn-1");
        session.setUpdatedAt(LocalDateTime.of(2026, 9, 21, 10, 30));
        when(sessionService.addSession(any(AddSessionDTO.class))).thenReturn(session);

        projectService.addProject(new AddProjectDTO(
                "user-1",
                "\n   \n   Build a CRM dashboard   \nSecond line",
                new AddProjectDTO.ModelDTO("deepseek", "deepseek-flash"),
                "project-request-2"));

        ArgumentCaptor<ProjectEntity> captor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projectRepository).add(captor.capture());
        assertThat(captor.getValue().getName()).isEqualTo("Build a CRM dashboard");
    }

    @Test
    void shouldKeepProjectNameWithinFortyEightCharacters() {
        doAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        }).when(transactionTemplate).execute(any(TransactionCallback.class));

        SessionInitVO session = new SessionInitVO();
        session.setSessionId("session-1");
        session.setTurnId("turn-1");
        session.setUpdatedAt(LocalDateTime.of(2026, 9, 21, 10, 30));
        when(sessionService.addSession(any(AddSessionDTO.class))).thenReturn(session);

        projectService.addProject(new AddProjectDTO(
                "user-1",
                "Build a very long customer relationship management dashboard with analytics",
                new AddProjectDTO.ModelDTO("deepseek", "deepseek-flash"),
                "project-request-3"));

        ArgumentCaptor<ProjectEntity> captor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projectRepository).add(captor.capture());
        assertThat(captor.getValue().getName()).hasSizeLessThanOrEqualTo(48);
    }

    @Test
    void shouldReturnExistingProjectForRepeatedRequest() {
        ProjectEntity existing = project("project-existing", "Existing");
        existing.setRequestId("project-request-existing");

        SessionVO session = new SessionVO();
        session.setId("session-existing");
        session.setUpdatedAt(LocalDateTime.of(2026, 9, 21, 11, 0));

        when(projectRepository.queryByRequestId("user-1", "project-request-existing"))
                .thenReturn(Optional.of(existing));
        when(sessionService.queryLatestSession("project-existing"))
                .thenReturn(Optional.of(session));

        ProjectListVO result = projectService.addProject(new AddProjectDTO(
                "user-1",
                "Build a CRM dashboard",
                new AddProjectDTO.ModelDTO("deepseek", "deepseek-flash"),
                "project-request-existing"));

        assertThat(result.getId()).isEqualTo("project-existing");
        assertThat(result.getLatestSessionId()).isEqualTo("session-existing");
        verify(projectRepository, never()).add(any());
        verify(sessionService, never()).addSession(any());
        verify(sessionService, never()).executeTurnAsync(any());
    }

    @Test
    void shouldMapRecentProjectActivityFromRepositoryProjection() {
        QueryProjectPageDTO dto = new QueryProjectPageDTO(1, 20, "user-1");

        ProjectEntity recent = project("project-recent", "Recent");
        recent.setLatestSessionId("session-recent");
        recent.setActivityTime(LocalDateTime.of(2026, 9, 21, 12, 0));

        ProjectEntity older = project("project-older", "Older");
        older.setLatestSessionId("session-older");
        older.setActivityTime(LocalDateTime.of(2026, 9, 21, 10, 0));

        when(projectRepository.queryProject(dto))
                .thenReturn(new PageData<>(List.of(recent, older), 2, 1, 1, 20));

        PageData<ProjectListVO> result = projectService.queryProject(dto);

        assertThat(result.records())
                .extracting(ProjectListVO::getId)
                .containsExactly("project-recent", "project-older");
        assertThat(result.records().getFirst().getLatestSessionId()).isEqualTo("session-recent");
        assertThat(result.records().getFirst().getUpdatedAt())
                .isEqualTo(LocalDateTime.of(2026, 9, 21, 12, 0));
    }

    private static ProjectEntity project(String id, String name) {
        ProjectEntity project = new ProjectEntity();
        project.setId(id);
        project.setName(name);
        project.setCreateTime(LocalDateTime.of(2026, 9, 21, 9, 0));
        project.setUpdateTime(LocalDateTime.of(2026, 9, 21, 9, 0));
        project.setCreateBy("user-1");
        return project;
    }
}
