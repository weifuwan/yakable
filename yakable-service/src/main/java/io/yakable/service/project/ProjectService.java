package io.yakable.service.project;

import io.yakable.common.BusinessException;
import io.yakable.common.ConverUtils;
import io.yakable.common.DateUtils;
import io.yakable.common.PageData;
import io.yakable.dao.entity.ProjectEntity;
import io.yakable.dao.repository.ProjectRepository;
import io.yakable.service.session.SessionService;
import io.yakable.service.turn.TurnDispatcher;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Project 业务服务。
 *
 * <p>负责 Project 的创建、查询和分页列表，并协调初始 Session 与 Turn 的创建。</p>
 */
public final class ProjectService {

    private static final int MAX_PROJECT_NAME_LENGTH = 48;
    private static final int MAX_PAGE_SIZE = 100;

    private final ProjectRepository repository;
    private final SessionService sessionService;
    private final TurnDispatcher turnDispatcher;
    private final TransactionTemplate transactionTemplate;

    public ProjectService(
            ProjectRepository repository,
            SessionService sessionService,
            TurnDispatcher turnDispatcher,
            TransactionTemplate transactionTemplate
    ) {
        this.repository = repository;
        this.sessionService = sessionService;
        this.turnDispatcher = turnDispatcher;
        this.transactionTemplate = transactionTemplate;
    }

    /**
     * 创建 Project，并同步创建首个 Session 和首轮 Turn。
     */
    public ProjectDetails createProject(
            String prompt,
            String provider,
            String model
    ) {
        if (StringUtils.isBlank(prompt)) {
            throw new BusinessException("prompt must not be blank");
        }
        if (StringUtils.isBlank(provider)) {
            throw new BusinessException("provider must not be blank");
        }
        if (StringUtils.isBlank(model)) {
            throw new BusinessException("model must not be blank");
        }

        String normalizedPrompt = StringUtils.strip(prompt);
        String normalizedProvider = StringUtils.strip(provider);
        String normalizedModel = StringUtils.strip(model);

        CreatedProject created = transactionTemplate.execute(status -> {
            LocalDateTime now = DateUtils.now();
            String name = projectName(normalizedPrompt);

            ProjectEntity project = new ProjectEntity();
            project.setId(UUID.randomUUID().toString());
            project.setName(name);
            project.setStatus("CREATED");
            project.setCreatedAt(DateUtils.toInstant(now));
            project.setUpdatedAt(DateUtils.toInstant(now));
            repository.save(project);

            SessionService.InitialSession session =
                    sessionService.createInitialSession(
                            project.getId(),
                            name,
                            normalizedProvider,
                            normalizedModel,
                            normalizedPrompt
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
     */
    public PageData<ProjectSummary> listProjects(
            int current,
            int pageSize
    ) {
        validatePage(current, pageSize);

        long total = repository.countProjectsWithSession();
        long offset = (long) (current - 1) * pageSize;

        List<ProjectSummary> records = repository
                .findProjectPage(offset, pageSize)
                .stream()
                .map(ProjectService::toSummary)
                .toList();

        return PageData.of(records, total, current, pageSize);
    }

    /**
     * 根据 Project ID 查询详情。
     */
    public Optional<ProjectDetails> getProject(String projectId) {
        if (StringUtils.isBlank(projectId)) {
            throw new BusinessException(
                    "projectId must not be blank"
            );
        }

        return repository.findProjectDetails(
                        StringUtils.strip(projectId)
                )
                .map(ProjectService::toDetails);
    }

    private static void validatePage(int current, int pageSize) {
        if (current <= 0) {
            throw new BusinessException(
                    "current must be greater than zero"
            );
        }

        if (pageSize <= 0 || pageSize > MAX_PAGE_SIZE) {
            throw new BusinessException(
                    "pageSize must be between 1 and "
                            + MAX_PAGE_SIZE
            );
        }
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
