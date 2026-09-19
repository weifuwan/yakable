package io.yakable.boot.project;

import io.yakable.core.application.project.ProjectBootstrapService;
import io.yakable.core.application.project.ProjectOverviewQueryService;
import io.yakable.core.project.ProjectRepository;
import io.yakable.core.session.SessionCommandService;
import io.yakable.core.session.SessionQueryService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ProjectConfiguration {

    @Bean
    ProjectRepository projectRepository() {
        return new InMemoryProjectRepository();
    }

    @Bean
    ProjectBootstrapService projectBootstrapService(
            ProjectRepository projectRepository,
            SessionCommandService sessionCommandService
    ) {
        return new ProjectBootstrapService(
                projectRepository,
                sessionCommandService
        );
    }

    @Bean
    ProjectOverviewQueryService projectOverviewQueryService(
            ProjectRepository projectRepository,
            SessionQueryService sessionQueryService
    ) {
        return new ProjectOverviewQueryService(
                projectRepository,
                sessionQueryService
        );
    }
}
