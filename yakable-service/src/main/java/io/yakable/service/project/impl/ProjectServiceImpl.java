package io.yakable.service.project.impl;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.enums.common.CommonErrorCode;
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
    public ProjectListVO addProject(AddProjectDTO dto) {
        requireUserId(dto.userId());
        String prompt = dto.prompt();
        CreatedProject created = transactionTemplate.execute(status -> {
            ProjectEntity project = new ProjectEntity();
            project.initCreate(dto.userId());
            project.setName(projectName(prompt));
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

        ProjectListVO result = ConverUtils.convert(created.project(), ProjectListVO.class);
        result.setLatestSessionId(created.session().getSessionId());
        result.setUpdatedAt(created.session().getUpdatedAt());
        return result;
    }

    @Override
    public PageData<ProjectListVO> queryProject(QueryProjectPageDTO dto) {
        return projectRepository.queryProject(dto).map(ProjectServiceImpl::toListVO);
    }

    private static ProjectListVO toListVO(ProjectEntity entity) {
        ProjectListVO result = ConverUtils.convert(entity, ProjectListVO.class);
        result.setLatestSessionId(entity.getLatestSessionId());
        result.setUpdatedAt(entity.getActivityTime());
        return result;
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
