package io.yakable.boot.configuration;

import io.yakable.service.message.MessageService;
import io.yakable.service.model.ModelClient;
import io.yakable.service.session.SessionService;
import io.yakable.service.turn.TurnExecutor;
import io.yakable.service.turn.TurnService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration(proxyBeanMethods = false)
public class ApplicationConfiguration {

    @Bean
    TransactionTemplate transactionTemplate(PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }

    @Bean
    TurnExecutor turnExecutor(
            SessionService sessionService,
            TurnService turnService,
            MessageService messageService,
            ModelClient modelClient,
            TransactionTemplate transactionTemplate) {
        return new TurnExecutor(sessionService, turnService, messageService, modelClient, transactionTemplate);
    }
}
