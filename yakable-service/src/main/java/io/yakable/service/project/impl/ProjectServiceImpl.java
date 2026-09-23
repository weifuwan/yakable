package io.yakable.service.project.impl;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.enums.common.CommonErrorCode;
import io.yakable.common.enums.session.TurnTypeEnum;
import io.yakable.common.exception.ProjectException;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.repository.ProjectRepository;
import io.yakable.service.observability.ConversationMetrics;
import io.yakable.service.project.ProjectService;
import io.yakable.service.session.SessionService;
import jakarta.annotation.Resource;
import org.apache.commons.lang3.StringUtils;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.validation.annotation.Validated;

import java.time.LocalDateTime;

@Service
@Validated
public class ProjectServiceImpl implements ProjectService {

    private static final System.Logger log = System.getLogger(ProjectServiceImpl.class.getName());
    private static final int MAX_PROJECT_NAME_LENGTH = 48;

    @Resource
    private ProjectRepository projectRepository;

    @Resource
    private SessionService sessionService;

    @Resource
    private TransactionTemplate transactionTemplate;

    @Resource
    private ConversationMetrics conversationMetrics;

    @Override
    public ProjectListVO addProject(AddProjectDTO dto) {
        requireUserId(dto.userId());
        ProjectEntity existing = projectRepository.queryByRequestId(dto.userId(), dto.requestId()).orElse(null);
        if (existing != null) {
            conversationMetrics.idempotencyReplay("project");
            log.log(
                    System.Logger.Level.INFO,
                    "Project idempotency replay requestId=" + dto.requestId()
                            + " userId=" + dto.userId()
                            + " projectId=" + existing.getId());
            return existingProject(existing);
        }

        String prompt = dto.prompt();
        CreatedProject created;
        try {
            created = transactionTemplate.execute(status -> {
                ProjectEntity project = new ProjectEntity();
                project.initCreate(dto.userId());
                project.setName(projectName(prompt));
                project.setRequestId(dto.requestId());
                projectRepository.add(project);

                SessionInitVO session = sessionService.addSession(
                        new AddSessionDTO(
                                project.getId(),
                                project.getName(),
                                dto.model().provider(),
                                dto.model().model(),
                                TurnTypeEnum.PROJECT_GENERATION,
                                prompt,
                                dto.requestId(),
                                dto.userId()));
                return new CreatedProject(project, session);
            });
        } catch (DuplicateKeyException exception) {
            ProjectEntity duplicate = projectRepository.queryByRequestId(dto.userId(), dto.requestId()).orElse(null);
            if (duplicate == null) {
                throw exception;
            }
            conversationMetrics.idempotencyReplay("project");
            log.log(
                    System.Logger.Level.INFO,
                    "Project idempotency replay after duplicate key requestId=" + dto.requestId()
                            + " userId=" + dto.userId()
                            + " projectId=" + duplicate.getId());
            return existingProject(duplicate);
        }

        sessionService.executeTurnAsync(created.session().getTurnId());
        return projectSummary(
                created.project(),
                created.session().getSessionId(),
                created.session().getUpdatedAt());
    }

    @Override
    public PageData<ProjectListVO> queryProject(QueryProjectPageDTO dto) {
        return projectRepository.queryProject(dto).map(ProjectServiceImpl::toListVO);
    }

    private ProjectListVO existingProject(ProjectEntity project) {
        SessionVO session = sessionService.queryLatestSession(project.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "Initial Session not found for Project: " + project.getId()));
        return projectSummary(project, session.getId(), session.getUpdatedAt());
    }

    private static ProjectListVO projectSummary(
            ProjectEntity project, String sessionId, LocalDateTime updatedAt) {
        ProjectListVO result = ConverUtils.convert(project, ProjectListVO.class);
        result.setLatestSessionId(sessionId);
        result.setUpdatedAt(updatedAt);
        return result;
    }

    private static ProjectListVO toListVO(ProjectEntity entity) {
        return projectSummary(entity, entity.getLatestSessionId(), entity.getActivityTime());
    }

    private static String projectName(String prompt) {
        String firstNonBlankLine = prompt.lines()
                .map(String::strip)
                .filter(line -> !line.isBlank())
                .findFirst()
                .orElse(prompt.strip());
        return StringUtils.abbreviate(firstNonBlankLine, MAX_PROJECT_NAME_LENGTH);
    }

    private static void requireUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ProjectException(CommonErrorCode.PARAM_NOT_VALID);
        }
    }

    private record CreatedProject(ProjectEntity project, SessionInitVO session) {
    }
}
