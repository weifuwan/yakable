package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.mapper.ProjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectRepositoryImplTest {

    @Mock
    private ProjectMapper projectMapper;

    @InjectMocks
    private ProjectRepositoryImpl projectRepository;

    @Test
    void shouldUseRecentActivityPageQueryForCurrentUser() {
        ProjectEntity recent = project("project-recent", LocalDateTime.of(2026, 9, 21, 12, 0));
        ProjectEntity older = project("project-older", LocalDateTime.of(2026, 9, 21, 10, 0));

        Page<ProjectEntity> mapperPage = new Page<>(1, 20);
        mapperPage.setRecords(List.of(recent, older));
        mapperPage.setTotal(2);

        when(projectMapper.selectRecentProjectPage(any(Page.class), eq("user-1")))
                .thenReturn(mapperPage);

        PageData<ProjectEntity> result =
                projectRepository.queryProject(new QueryProjectPageDTO(1, 20, "user-1"));

        @SuppressWarnings("rawtypes")
        ArgumentCaptor<Page> pageCaptor = ArgumentCaptor.forClass(Page.class);
        verify(projectMapper).selectRecentProjectPage(pageCaptor.capture(), eq("user-1"));

        assertThat(pageCaptor.getValue().getCurrent()).isEqualTo(1);
        assertThat(pageCaptor.getValue().getSize()).isEqualTo(20);
        assertThat(result.records())
                .extracting(ProjectEntity::getId)
                .containsExactly("project-recent", "project-older");
        assertThat(result.records().getFirst().getActivityTime())
                .isEqualTo(LocalDateTime.of(2026, 9, 21, 12, 0));
    }

    private static ProjectEntity project(String id, LocalDateTime activityTime) {
        ProjectEntity project = new ProjectEntity();
        project.setId(id);
        project.setName(id);
        project.setLatestSessionId("session-" + id);
        project.setActivityTime(activityTime);
        return project;
    }
}
