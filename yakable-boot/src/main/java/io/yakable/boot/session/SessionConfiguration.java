package io.yakable.boot.session;

import io.yakable.core.model.ModelRuntime;
import io.yakable.core.session.SessionCommandService;
import io.yakable.core.session.SessionExecutionRepository;
import io.yakable.core.session.SessionQueryService;
import io.yakable.core.session.SessionRepository;
import io.yakable.core.session.TurnExecutor;
import io.yakable.core.session.TurnPromptAssembler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration(proxyBeanMethods = false)
public class SessionConfiguration {

    @Bean
    SessionRepository sessionRepository() {
        return new InMemorySessionRepository();
    }

    @Bean
    SessionExecutionRepository sessionExecutionRepository() {
        return new InMemorySessionExecutionRepository();
    }

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
            ModelRuntime modelRuntime,
            TurnPromptAssembler promptAssembler
    ) {
        return new TurnExecutor(
                sessionRepository,
                executionRepository,
                modelRuntime,
                promptAssembler
        );
    }

    @Bean(destroyMethod = "close")
    ExecutorService sessionTurnExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean
    SessionTurnDispatcher sessionTurnDispatcher(
            ExecutorService sessionTurnExecutor,
            TurnExecutor turnExecutor
    ) {
        return new SessionTurnDispatcher(
                sessionTurnExecutor,
                turnExecutor
        );
    }
}
