package io.yakable.boot.project;

import io.yakable.core.project.ProjectCommandService;
import io.yakable.core.project.ProjectQueryService;
import io.yakable.core.project.ProjectRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ProjectConfiguration {

    @Bean
    ProjectRepository projectRepository() {
        return new InMemoryProjectRepository();
    }

    @Bean
    ProjectCommandService projectCommandService(ProjectRepository projectRepository) {
        return new ProjectCommandService(projectRepository);
    }

    @Bean
    ProjectQueryService projectQueryService(ProjectRepository projectRepository) {
        return new ProjectQueryService(projectRepository);
    }
}
