package io.yakable.boot.configuration;

import io.yakable.dao.repository.ProjectRepository;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.model.ModelClient;
import io.yakable.service.project.ProjectService;
import io.yakable.service.session.SessionService;
import io.yakable.service.turn.TurnDispatcher;
import io.yakable.service.turn.TurnExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration(proxyBeanMethods = false)
public class ApplicationConfiguration {

    @Bean
    TransactionTemplate transactionTemplate(
            PlatformTransactionManager transactionManager
    ) {
        return new TransactionTemplate(transactionManager);
    }

    @Bean
    TurnExecutor turnExecutor(
            SessionRepository sessionRepository,
            ModelClient modelClient,
            TransactionTemplate transactionTemplate
    ) {
        return new TurnExecutor(
                sessionRepository,
                modelClient,
                transactionTemplate
        );
    }

    @Bean
    SessionService sessionService(
            SessionRepository sessionRepository,
            TurnDispatcher turnDispatcher,
            TransactionTemplate transactionTemplate
    ) {
        return new SessionService(
                sessionRepository,
                turnDispatcher,
                transactionTemplate
        );
    }

    @Bean
    ProjectService projectService(
            ProjectRepository projectRepository,
            SessionService sessionService,
            TurnDispatcher turnDispatcher,
            TransactionTemplate transactionTemplate
    ) {
        return new ProjectService(
                projectRepository,
                sessionService,
                turnDispatcher,
                transactionTemplate
        );
    }
}
