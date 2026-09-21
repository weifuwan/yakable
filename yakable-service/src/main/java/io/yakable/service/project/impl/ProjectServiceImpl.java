package io.yakable.service.project.impl;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.enums.common.CommonErrorCode;
import io.yakable.common.enums.project.ProjectErrorCode;
import io.yakable.common.enums.project.ProjectStatusEnum;
import io.yakable.common.exception.ProjectException;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.repository.ProjectRepository;
import io.yakable.service.project.ProjectService;
import io.yakable.service.session.SessionService;
import jakarta.annotation.Resource;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.validation.annotation.Validated;

import java.time.LocalDateTime;

@Service
@Validated
public class ProjectServiceImpl implements ProjectService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;

    @Resource
    private ProjectRepository projectRepository;

    @Resource
    private SessionService sessionService;

    @Resource
    private TransactionTemplate transactionTemplate;

    @Override
    public ProjectDetailVO addProject(AddProjectDTO dto) {
        requireUserId(dto.userId());
        String prompt = dto.prompt();
        CreatedProject created = transactionTemplate.execute(status -> {
            ProjectEntity project = new ProjectEntity();
            project.initCreate(dto.userId());
            project.setName(projectName(prompt));
            project.setStatus(ProjectStatusEnum.CREATED);
            projectRepository.add(project);

            SessionInitVO session = sessionService.addSession(
                    new AddSessionDTO(
                            project.getId(),
                            project.getName(),
                            dto.model().provider(),
                            dto.model().model(),
                            prompt,
                            dto.userId()));
            return new CreatedProject(project, session);
        });

        sessionService.executeTurnAsync(created.session().getTurnId());

        ProjectDetailVO result = toDetailVO(created.project(), null);
        result.setLatestSessionId(created.session().getSessionId());
        result.setUpdatedAt(created.session().getUpdatedAt());
        return result;
    }

    @Override
    public PageData<ProjectListVO> queryProject(QueryProjectPageDTO dto) {
        return projectRepository.queryProject(dto).map(ProjectServiceImpl::toListVO);
    }

    @Override
    public ProjectDetailVO queryProject(QueryProjectDTO dto) {
        ProjectEntity entity = projectRepository.queryProject(dto.projectId(), dto.userId())
                .orElseThrow(() -> new ProjectException(ProjectErrorCode.NOT_FOUND));
        return toDetailVO(entity, sessionService.queryLatestSession(entity.getId()).orElse(null));
    }

    private static ProjectListVO toListVO(ProjectEntity entity) {
        ProjectListVO result = ConverUtils.convert(entity, ProjectListVO.class);
        result.setLatestSessionId(entity.getLatestSessionId());
        result.setUpdatedAt(entity.getActivityTime());
        return result;
    }

    private static ProjectDetailVO toDetailVO(ProjectEntity entity, SessionVO session) {
        ProjectDetailVO result = ConverUtils.convert(entity, ProjectDetailVO.class);
        result.setStatus(entity.getStatus().name());
        result.setCreatedAt(entity.getCreateTime());
        if (session != null) {
            result.setLatestSessionId(session.getId());
        }
        result.setUpdatedAt(latestUpdateTime(entity.getUpdateTime(), session));
        return result;
    }

    private static LocalDateTime latestUpdateTime(LocalDateTime projectTime, SessionVO session) {
        if (session == null || session.getUpdatedAt() == null || !session.getUpdatedAt().isAfter(projectTime)) {
            return projectTime;
        }
        return session.getUpdatedAt();
    }

    private static String projectName(String prompt) {
        String firstLine = prompt.lines().findFirst().orElse(prompt);
        return StringUtils.abbreviate(firstLine.strip(), MAX_PROJECT_NAME_LENGTH);
    }

    private static void requireUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ProjectException(CommonErrorCode.PARAM_NOT_VALID);
        }
    }

    private record CreatedProject(ProjectEntity project, SessionInitVO session) {
    }
}
