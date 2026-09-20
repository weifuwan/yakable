package io.yakable.service.project;

import io.yakable.common.ConverUtils;
import io.yakable.common.DateUtils;
import io.yakable.common.PageData;
import io.yakable.common.bean.dto.AddProjectDTO;
import io.yakable.common.bean.dto.QueryProjectDTO;
import io.yakable.common.bean.dto.QueryProjectPageDTO;
import io.yakable.common.bean.vo.ProjectDetailVO;
import io.yakable.common.bean.vo.ProjectListVO;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
    public ProjectDetailVO addProject(
            @NotNull @Valid AddProjectDTO dto
    ) {
        String prompt = StringUtils.strip(dto.prompt());
        String provider = StringUtils.strip(dto.model().provider());
        String model = StringUtils.strip(dto.model().model());

        CreatedProject created = transactionTemplate.execute(status -> {
            LocalDateTime now = DateUtils.now();
            String name = projectName(prompt);

            ProjectEntity project = new ProjectEntity();
            project.setId(UUID.randomUUID().toString());
            project.setName(name);
            project.setStatus("CREATED");
            project.setCreatedAt(DateUtils.toInstant(now));
            project.setUpdatedAt(DateUtils.toInstant(now));
            projectRepository.save(project);

            SessionService.InitialSession session =
                    sessionService.createInitialSession(
                            project.getId(),
                            name,
                            provider,
                            model,
                            prompt
                    );

            return new CreatedProject(project, session);
        });

        turnDispatcher.dispatch(created.session().turnId());

        ProjectDetailVO detailVO = toDetailVO(created.project());
        detailVO.setLatestSessionId(created.session().sessionId());
        detailVO.setUpdatedAt(
                DateUtils.toLocalDateTime(
                        created.session().updatedAt()
                )
        );
        return detailVO;
    }

    /**
     * 分页查询 Project。
     *
     * @param dto 分页查询入参
     * @return Project 列表分页数据
     */
    public PageData<ProjectListVO> queryProject(
            @NotNull @Valid QueryProjectPageDTO dto
    ) {
        long total = projectRepository.countProjectsWithSession();
        long offset = (long) (dto.current() - 1) * dto.pageSize();

        List<ProjectListVO> records = projectRepository
                .findProjectPage(offset, dto.pageSize())
                .stream()
                .map(ProjectService::toListVO)
                .toList();

        return PageData.of(
                records,
                total,
                dto.current(),
                dto.pageSize()
        );
    }

    /**
     * 根据 Project ID 查询详情。
     *
     * @param dto Project 查询入参
     * @return Project 详情
     */
    public Optional<ProjectDetailVO> queryProject(
            @NotNull @Valid QueryProjectDTO dto
    ) {
        return projectRepository.findProjectDetails(
                        StringUtils.strip(dto.projectId())
                )
                .map(ProjectService::toDetailVO);
    }

    private static ProjectListVO toListVO(ProjectEntity entity) {
        ProjectListVO listVO = ConverUtils.convert(
                entity,
                ProjectListVO.class
        );
        listVO.setUpdatedAt(
                DateUtils.toLocalDateTime(entity.getUpdatedAt())
        );
        return listVO;
    }

    private static ProjectDetailVO toDetailVO(ProjectEntity entity) {
        ProjectDetailVO detailVO = ConverUtils.convert(
                entity,
                ProjectDetailVO.class
        );
        detailVO.setCreatedAt(
                DateUtils.toLocalDateTime(entity.getCreatedAt())
        );
        detailVO.setUpdatedAt(
                DateUtils.toLocalDateTime(entity.getUpdatedAt())
        );
        return detailVO;
    }

    private static String projectName(String prompt) {
        String firstLine = prompt.lines()
                .findFirst()
                .orElse(prompt);

        return StringUtils.abbreviate(
                StringUtils.strip(firstLine),
                MAX_PROJECT_NAME_LENGTH
        );
    }

    private record CreatedProject(
            ProjectEntity project,
            SessionService.InitialSession session
    ) {
    }
}
