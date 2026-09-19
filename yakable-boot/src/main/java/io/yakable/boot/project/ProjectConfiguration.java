package io.yakable.boot.project;

import io.yakable.core.project.ProjectCommandService;
import io.yakable.core.project.ProjectQueryService;
import io.yakable.core.project.ProjectRepository;
import io.yakable.core.session.SessionRepository;
import io.yakable.core.session.SessionService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ProjectConfiguration {

    @Bean
    ProjectRepository projectRepository() {
        return new InMemoryProjectRepository();
    }

    @Bean
    ProjectCommandService projectCommandService(
            ProjectRepository projectRepository,
            SessionService sessionService
    ) {
        return new ProjectCommandService(
                projectRepository,
                sessionService
        );
    }

    @Bean
    ProjectQueryService projectQueryService(
            ProjectRepository projectRepository,
            SessionRepository sessionRepository
    ) {
        return new ProjectQueryService(
                projectRepository,
                sessionRepository
        );
    }
}
