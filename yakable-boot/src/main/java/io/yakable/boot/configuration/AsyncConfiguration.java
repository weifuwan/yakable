package io.yakable.boot.configuration;

import io.yakable.boot.configuration.properties.TurnExecutionProperties;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.turn.TurnDispatcher;
import io.yakable.service.turn.TurnExecutor;
import io.yakable.service.turn.TurnRecoveryWorker;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(TurnExecutionProperties.class)
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
        return new TurnDispatcher(
                sessionTurnExecutor,
                turnExecutor
        );
    }

    @Bean(destroyMethod = "close")
    ScheduledExecutorService turnRecoveryScheduler() {
        return Executors.newSingleThreadScheduledExecutor();
    }

    @Bean(initMethod = "start", destroyMethod = "close")
    TurnRecoveryWorker turnRecoveryWorker(
            ScheduledExecutorService turnRecoveryScheduler,
            SessionRepository sessionRepository,
            TurnDispatcher turnDispatcher,
            TurnExecutionProperties properties
    ) {
        return new TurnRecoveryWorker(
                turnRecoveryScheduler,
                sessionRepository,
                turnDispatcher,
                properties.recoveryInterval(),
                properties.runningTimeout(),
                properties.recoveryBatchSize(),
                properties.recoveryEnabled()
        );
    }
}
