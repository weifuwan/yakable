package io.yakable.service.project;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.common.PageDTO;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.enums.project.ProjectStatusEnum;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.repository.ProjectRepository;
import io.yakable.service.session.SessionService;
import io.yakable.service.turn.TurnDispatcher;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.validation.annotation.Validated;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Project 业务服务。
 *
 * <p>负责 Project 自身业务，并通过 SessionService 编排 Session 业务。</p>
 */
@Service
@Validated
public class ProjectService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;

    @Resource
    private ProjectRepository projectRepository;

    @Resource
    private SessionService sessionService;

    @Resource
    private TurnDispatcher turnDispatcher;

    @Resource
    private TransactionTemplate transactionTemplate;

    /**
     * 新增 Project，并同步创建首个 Session 和首轮 Turn。
     */
    public ProjectDetailVO addProject(@NotNull @Valid AddProjectDTO dto) {
        String prompt = dto.prompt();
        CreatedProject created = transactionTemplate.execute(status -> {
            ProjectEntity project = new ProjectEntity();
            project.initCreate();
            project.setName(projectName(prompt));
            project.setStatus(ProjectStatusEnum.CREATED);
            projectRepository.add(project);

            SessionInitVO session = sessionService.addSession(
                    new AddSessionDTO(project.getId(), project.getName(), dto.model().provider(), dto.model().model(), prompt));
            return new CreatedProject(project, session);
        });

        turnDispatcher.dispatch(created.session().getTurnId());

        ProjectDetailVO result = toDetailVO(created.project(), null);
        result.setLatestSessionId(created.session().getSessionId());
        result.setUpdatedAt(created.session().getUpdatedAt());
        return result;
    }

    /**
     * 分页查询 Project。
     */
    public PageData<ProjectListVO> queryProject(@NotNull @Valid PageDTO dto) {
        return projectRepository.queryPage(dto).map(this::toListVO);
    }

    /**
     * 根据 Project ID 查询详情。
     */
    public Optional<ProjectDetailVO> queryProject(@NotNull @Valid QueryProjectDTO dto) {
        return projectRepository.queryById(dto.projectId())
                .map(entity -> toDetailVO(entity, sessionService.queryLatestSession(entity.getId()).orElse(null)));
    }

    private ProjectListVO toListVO(ProjectEntity entity) {
        SessionVO session = sessionService.queryLatestSession(entity.getId()).orElse(null);
        ProjectListVO result = ConverUtils.convert(entity, ProjectListVO.class);
        if (session != null) {
            result.setLatestSessionId(session.getId());
        }
        result.setUpdatedAt(latestUpdateTime(entity.getUpdateTime(), session));
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

    private record CreatedProject(ProjectEntity project, SessionInitVO session) {
    }
}
