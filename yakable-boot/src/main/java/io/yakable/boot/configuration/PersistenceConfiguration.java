package io.yakable.boot.configuration;

import io.yakable.domain.project.repository.ProjectRepository;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;
import io.yakable.infrastructure.persistence.memory.project.InMemoryProjectRepository;
import io.yakable.infrastructure.persistence.memory.session.InMemorySessionExecutionRepository;
import io.yakable.infrastructure.persistence.memory.session.InMemorySessionRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class PersistenceConfiguration {

    @Bean
    ProjectRepository projectRepository() {
        return new InMemoryProjectRepository();
    }

    @Bean
    SessionRepository sessionRepository() {
        return new InMemorySessionRepository();
    }

    @Bean
    SessionExecutionRepository sessionExecutionRepository() {
        return new InMemorySessionExecutionRepository();
    }
}
