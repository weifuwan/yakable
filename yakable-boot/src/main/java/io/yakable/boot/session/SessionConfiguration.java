package io.yakable.boot.session;

import io.yakable.core.model.ModelRuntime;
import io.yakable.core.session.SessionMessageRepository;
import io.yakable.core.session.SessionRepository;
import io.yakable.core.session.SessionService;
import io.yakable.core.session.TurnRepository;
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
    TurnRepository turnRepository() {
        return new InMemoryTurnRepository();
    }

    @Bean
    SessionMessageRepository sessionMessageRepository() {
        return new InMemorySessionMessageRepository();
    }

    @Bean
    SessionService sessionService(
            SessionRepository sessionRepository,
            TurnRepository turnRepository,
            SessionMessageRepository messageRepository,
            ModelRuntime modelRuntime
    ) {
        return new SessionService(
                sessionRepository,
                turnRepository,
                messageRepository,
                modelRuntime
        );
    }

    @Bean(destroyMethod = "close")
    ExecutorService sessionTurnExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean
    SessionTurnDispatcher sessionTurnDispatcher(
            ExecutorService sessionTurnExecutor,
            SessionService sessionService
    ) {
        return new SessionTurnDispatcher(
                sessionTurnExecutor,
                sessionService
        );
    }
}
