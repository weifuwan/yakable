package io.yakable.application.transaction;

import java.util.function.Supplier;

/**
 * Application-owned transaction boundary.
 *
 * <p>The application layer decides what must commit atomically while the
 * persistence adapter decides how that transaction is implemented.</p>
 */
public interface TransactionRunner {

    <T> T required(Supplier<T> action);
}
