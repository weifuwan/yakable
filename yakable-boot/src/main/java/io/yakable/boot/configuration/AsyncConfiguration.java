package io.yakable.boot.configuration;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.session.TurnExecutor;
import io.yakable.infrastructure.async.VirtualThreadTurnDispatcher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration(proxyBeanMethods = false)
public class AsyncConfiguration {

    @Bean(destroyMethod = "close")
    ExecutorService sessionTurnExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean
    TurnDispatcher turnDispatcher(
            ExecutorService sessionTurnExecutor,
            TurnExecutor turnExecutor
    ) {
        return new VirtualThreadTurnDispatcher(
                sessionTurnExecutor,
                turnExecutor
        );
    }
}
