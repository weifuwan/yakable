package io.yakable.boot.configuration;

import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.model.ModelClient;
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

}
