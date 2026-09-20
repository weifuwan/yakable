package io.yakable.boot.configuration;

import io.yakable.boot.configuration.properties.TurnExecutionProperties;
import io.yakable.common.utils.ThreadUtils;
import io.yakable.service.turn.TurnDispatcher;
import io.yakable.service.turn.TurnExecutor;
import io.yakable.service.turn.TurnRecoveryWorker;
import io.yakable.service.turn.TurnService;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(TurnExecutionProperties.class)
public class AsyncConfiguration {

    @Bean(destroyMethod = "close")
    ExecutorService sessionTurnExecutor() {
        return ThreadUtils.newVirtualThreadExecutor("yakable-turn-");
    }

    @Bean
    TurnDispatcher turnDispatcher(ExecutorService sessionTurnExecutor, TurnExecutor turnExecutor) {
        return new TurnDispatcher(sessionTurnExecutor, turnExecutor);
    }

    @Bean(destroyMethod = "close")
    ScheduledExecutorService turnRecoveryScheduler() {
        return ThreadUtils.newSingleScheduledExecutor("yakable-turn-recovery-");
    }

    @Bean(initMethod = "start", destroyMethod = "close")
    TurnRecoveryWorker turnRecoveryWorker(
            ScheduledExecutorService turnRecoveryScheduler,
            TurnService turnService,
            TurnDispatcher turnDispatcher,
            TurnExecutionProperties properties) {
        return new TurnRecoveryWorker(
                turnRecoveryScheduler,
                turnService,
                turnDispatcher,
                properties.recoveryInterval(),
                properties.runningTimeout(),
                properties.recoveryBatchSize(),
                properties.recoveryEnabled());
    }
}
