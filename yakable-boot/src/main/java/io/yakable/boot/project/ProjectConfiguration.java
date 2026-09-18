package io.yakable.boot.project;

import io.yakable.core.project.ProjectQueryService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ProjectConfiguration {

    @Bean
    ProjectQueryService projectQueryService() {
        return new ProjectQueryService();
    }
}
