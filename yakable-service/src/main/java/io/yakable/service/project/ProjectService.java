package io.yakable.service.project;

import io.yakable.common.ConverUtils;
import io.yakable.common.DateUtils;
import io.yakable.common.PageData;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.repository.ProjectRepository;
import io.yakable.service.project.dto.AddProjectDTO;
import io.yakable.service.project.dto.QueryProjectDTO;
import io.yakable.service.project.dto.QueryProjectPageDTO;
import io.yakable.service.session.SessionService;
import io.yakable.service.turn.TurnDispatcher;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import lombok.Getter;
import lombok.Setter;
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
    public ProjectDetails addProject(@Valid AddProjectDTO dto) {
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

        ProjectDetails details = toDetails(created.project());
        details.setLatestSessionId(created.session().sessionId());
        details.setUpdatedAt(
                DateUtils.toLocalDateTime(
                        created.session().updatedAt()
                )
        );
        return details;
    }

    /**
     * 分页查询 Project。
     *
     * @param dto 分页查询入参
     * @return Project 分页数据
     */
    public PageData<ProjectSummary> queryProject(
            @Valid QueryProjectPageDTO dto
    ) {
        long total = projectRepository.countProjectsWithSession();
        long offset = (long) (dto.current() - 1) * dto.pageSize();

        List<ProjectSummary> records = projectRepository
                .findProjectPage(offset, dto.pageSize())
                .stream()
                .map(ProjectService::toSummary)
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
    public Optional<ProjectDetails> queryProject(
            @Valid QueryProjectDTO dto
    ) {
        return projectRepository.findProjectDetails(
                        StringUtils.strip(dto.projectId())
                )
                .map(ProjectService::toDetails);
    }

    private static ProjectSummary toSummary(ProjectEntity entity) {
        ProjectSummary summary = ConverUtils.convert(
                entity,
                ProjectSummary.class
        );
        summary.setUpdatedAt(
                DateUtils.toLocalDateTime(entity.getUpdatedAt())
        );
        return summary;
    }

    private static ProjectDetails toDetails(ProjectEntity entity) {
        ProjectDetails details = ConverUtils.convert(
                entity,
                ProjectDetails.class
        );
        details.setCreatedAt(
                DateUtils.toLocalDateTime(entity.getCreatedAt())
        );
        details.setUpdatedAt(
                DateUtils.toLocalDateTime(entity.getUpdatedAt())
        );
        return details;
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

    /**
     * Project 列表项。
     */
    @Getter
    @Setter
    public static class ProjectSummary {

        private String id;
        private String name;
        private String latestSessionId;
        private LocalDateTime updatedAt;
    }

    /**
     * Project 详情。
     */
    @Getter
    @Setter
    public static class ProjectDetails {

        private String id;
        private String name;
        private String latestSessionId;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}
