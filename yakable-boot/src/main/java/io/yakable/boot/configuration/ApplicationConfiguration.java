package io.yakable.boot.configuration;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.model.ModelGateway;
import io.yakable.application.project.ProjectBootstrapService;
import io.yakable.application.project.ProjectOverviewQueryService;
import io.yakable.application.session.SessionCommandService;
import io.yakable.application.session.SessionQueryService;
import io.yakable.application.session.SessionTurnService;
import io.yakable.application.session.TurnExecutor;
import io.yakable.application.session.TurnPromptAssembler;
import io.yakable.application.transaction.TransactionRunner;
import io.yakable.domain.project.repository.ProjectRepository;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.domain.session.repository.SessionRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ApplicationConfiguration {

    @Bean
    SessionCommandService sessionCommandService(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository
    ) {
        return new SessionCommandService(
                sessionRepository,
                executionRepository
        );
    }

    @Bean
    SessionQueryService sessionQueryService(
            SessionRepository sessionRepository,
            SessionExecutionRepository executionRepository
    ) {
        return new SessionQueryService(
                sessionRepository,
                executionRepository
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

    @Bean
    SessionTurnService sessionTurnService(
            SessionCommandService commandService,
            TurnDispatcher turnDispatcher,
            TransactionRunner transactionRunner
    ) {
        return new SessionTurnService(
                commandService,
                turnDispatcher,
                transactionRunner
        );
    }

    @Bean
    ProjectBootstrapService projectBootstrapService(
            ProjectRepository projectRepository,
            SessionCommandService sessionCommandService,
            TurnDispatcher turnDispatcher,
            TransactionRunner transactionRunner
    ) {
        return new ProjectBootstrapService(
                projectRepository,
                sessionCommandService,
                turnDispatcher,
                transactionRunner
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
