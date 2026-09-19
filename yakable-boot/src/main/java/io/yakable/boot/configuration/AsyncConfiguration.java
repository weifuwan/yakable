package io.yakable.boot.configuration;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.session.TurnExecutionRecoveryService;
import io.yakable.application.session.TurnExecutor;
import io.yakable.boot.configuration.properties.TurnExecutionProperties;
import io.yakable.domain.session.repository.SessionExecutionRepository;
import io.yakable.infrastructure.async.TurnRecoveryWorker;
import io.yakable.infrastructure.async.VirtualThreadTurnDispatcher;
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
        return new VirtualThreadTurnDispatcher(
                sessionTurnExecutor,
                turnExecutor
        );
    }

    @Bean
    TurnExecutionRecoveryService turnExecutionRecoveryService(
            SessionExecutionRepository executionRepository,
            TurnDispatcher turnDispatcher,
            TurnExecutionProperties properties
    ) {
        return new TurnExecutionRecoveryService(
                executionRepository,
                turnDispatcher,
                properties.runningTimeout(),
                properties.recoveryBatchSize()
        );
    }

    @Bean(destroyMethod = "close")
    ScheduledExecutorService turnRecoveryScheduler() {
        return Executors.newSingleThreadScheduledExecutor();
    }

    @Bean(initMethod = "start", destroyMethod = "close")
    TurnRecoveryWorker turnRecoveryWorker(
            ScheduledExecutorService turnRecoveryScheduler,
            TurnExecutionRecoveryService recoveryService,
            TurnExecutionProperties properties
    ) {
        return new TurnRecoveryWorker(
                turnRecoveryScheduler,
                recoveryService,
                properties.recoveryInterval(),
                properties.recoveryEnabled()
        );
    }
}
