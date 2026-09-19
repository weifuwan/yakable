package io.yakable.boot.configuration;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.model.ModelGateway;
import io.yakable.application.project.ProjectQueryRepository;
import io.yakable.application.session.SessionQueryRepository;
import io.yakable.application.session.TurnExecutor;
import io.yakable.application.session.TurnPromptAssembler;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.project.repository.ProjectRepository;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;
import io.yakable.service.project.ProjectService;
import io.yakable.service.session.SessionService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ApplicationConfiguration {

    @Bean
    SessionService sessionService(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository,
            SessionQueryRepository queryRepository,
            TurnDispatcher turnDispatcher,
            TransactionRunner transactionRunner
    ) {
        return new SessionService(
                sessionRepository,
                executionRepository,
                queryRepository,
                turnDispatcher,
                transactionRunner
        );
    }

    @Bean
    ProjectService projectService(
            ProjectRepository projectRepository,
            ProjectQueryRepository queryRepository,
            SessionService sessionService,
            TurnDispatcher turnDispatcher,
            TransactionRunner transactionRunner
    ) {
        return new ProjectService(
                projectRepository,
                queryRepository,
                sessionService,
                turnDispatcher,
                transactionRunner
        );
    }

    @Bean
    TurnPromptAssembler turnPromptAssembler() {
        return new TurnPromptAssembler();
    }

    @Bean
    TurnExecutor turnExecutor(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository,
            ModelGateway modelGateway,
            TurnPromptAssembler promptAssembler,
            TransactionRunner transactionRunner
    ) {
        return new TurnExecutor(
                sessionRepository,
                executionRepository,
                modelGateway,
                promptAssembler,
                transactionRunner
        );
    }
}
