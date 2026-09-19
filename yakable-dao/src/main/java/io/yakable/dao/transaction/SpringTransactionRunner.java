package io.yakable.dao.transaction;

import io.yakable.application.transaction.TransactionRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Objects;
import java.util.function.Supplier;

@Component
public final class SpringTransactionRunner
        implements TransactionRunner {

    private final TransactionTemplate transactionTemplate;

    public SpringTransactionRunner(
            PlatformTransactionManager transactionManager
    ) {
        this.transactionTemplate = new TransactionTemplate(
                Objects.requireNonNull(
                        transactionManager,
                        "transactionManager"
                )
        );
    }

    @Override
    public <T> T required(Supplier<T> action) {
        Objects.requireNonNull(action, "action");
        return transactionTemplate.execute(status -> action.get());
    }
}
