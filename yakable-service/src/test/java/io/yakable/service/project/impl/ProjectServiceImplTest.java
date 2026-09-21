package io.yakable.service.project.impl;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
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
                new AddProjectDTO.ModelDTO("deepseek", "deepseek-flash"));

        ProjectDetailVO result = projectService.addProject(dto);

        ArgumentCaptor<ProjectEntity> projectCaptor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projectRepository).add(projectCaptor.capture());
        ProjectEntity savedProject = projectCaptor.getValue();

        assertThat(savedProject.getName()).isEqualTo("Build a CRM dashboard");
        assertThat(savedProject.getCreateBy()).isEqualTo("user-1");
        assertThat(savedProject.getStatus()).isEqualTo(ProjectStatusEnum.CREATED);

        ArgumentCaptor<AddSessionDTO> sessionCaptor = ArgumentCaptor.forClass(AddSessionDTO.class);
        verify(sessionService).addSession(sessionCaptor.capture());
        assertThat(sessionCaptor.getValue().userId()).isEqualTo("user-1");

        verify(sessionService).executeTurnAsync("turn-1");
        assertThat(result.getId()).isEqualTo(savedProject.getId());
        assertThat(result.getLatestSessionId()).isEqualTo("session-1");
        assertThat(result.getUpdatedAt()).isEqualTo(sessionUpdatedAt);
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

    @Test
    void shouldHideProjectOwnedByAnotherUserAsNotFound() {
        when(projectRepository.queryProject("project-1", "user-2")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.queryProject(new QueryProjectDTO("project-1", "user-2")))
                .isInstanceOf(ProjectException.class)
                .satisfies(exception ->
                        assertThat(((ProjectException) exception).getErrorCode()).isEqualTo(ProjectErrorCode.NOT_FOUND));
    }

    private static ProjectEntity project(String id, String name) {
        ProjectEntity project = new ProjectEntity();
        project.setId(id);
        project.setName(name);
        project.setStatus(ProjectStatusEnum.CREATED);
        project.setCreateTime(LocalDateTime.of(2026, 9, 21, 9, 0));
        project.setUpdateTime(LocalDateTime.of(2026, 9, 21, 9, 0));
        project.setCreateBy("user-1");
        return project;
    }
}
