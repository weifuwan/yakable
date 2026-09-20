package io.yakable.service.project;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.dto.PageDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
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

import java.util.Optional;

/**
 * Project 业务服务。
 *
 * <p>负责 Project 的新增和查询，并协调初始 Session 与 Turn 的创建。</p>
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
     *
     * @param dto 新增 Project 入参
     * @return Project 详情
     */
    public ProjectDetailVO addProject(@NotNull @Valid AddProjectDTO dto) {
        String prompt = StringUtils.strip(dto.prompt());
        String provider = StringUtils.strip(dto.model().provider());
        String model = StringUtils.strip(dto.model().model());

        CreatedProject created = transactionTemplate.execute(status -> {
            ProjectEntity project = new ProjectEntity();
            project.initCreate();
            project.setName(projectName(prompt));
            project.setStatus(ProjectStatusEnum.CREATED);
            projectRepository.add(project);

            SessionInitVO session = sessionService.addSession(
                    new AddSessionDTO(project.getId(), project.getName(), provider, model, prompt));
            return new CreatedProject(project, session);
        });

        turnDispatcher.dispatch(created.session().getTurnId());

        ProjectDetailVO detailVO = toDetailVO(created.project());
        detailVO.setLatestSessionId(created.session().getSessionId());
        detailVO.setUpdatedAt(created.session().getUpdatedAt());
        return detailVO;
    }

    /**
     * 分页查询 Project。
     *
     * @param dto 分页查询入参
     * @return Project 列表分页数据
     */
    public PageData<ProjectListVO> queryProject(@NotNull @Valid PageDTO dto) {
        return projectRepository.queryProject(dto).map(ProjectService::toListVO);
    }

    /**
     * 根据 Project ID 查询详情。
     *
     * @param dto Project 查询入参
     * @return Project 详情
     */
    public Optional<ProjectDetailVO> queryProject(@NotNull @Valid QueryProjectDTO dto) {
        return projectRepository.queryProject(StringUtils.strip(dto.projectId()))
                .map(ProjectService::toDetailVO);
    }

    private static ProjectListVO toListVO(ProjectEntity entity) {
        ProjectListVO listVO = ConverUtils.convert(entity, ProjectListVO.class);
        listVO.setUpdatedAt(entity.getUpdateTime());
        return listVO;
    }

    private static ProjectDetailVO toDetailVO(ProjectEntity entity) {
        ProjectDetailVO detailVO = ConverUtils.convert(entity, ProjectDetailVO.class);
        detailVO.setStatus(entity.getStatus().name());
        detailVO.setCreatedAt(entity.getCreateTime());
        detailVO.setUpdatedAt(entity.getUpdateTime());
        return detailVO;
    }

    private static String projectName(String prompt) {
        String firstLine = prompt.lines().findFirst().orElse(prompt);
        return StringUtils.abbreviate(StringUtils.strip(firstLine), MAX_PROJECT_NAME_LENGTH);
    }

    private record CreatedProject(ProjectEntity project, SessionInitVO session) {
    }
}
