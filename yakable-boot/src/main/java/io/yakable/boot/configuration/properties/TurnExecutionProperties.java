package io.yakable.boot.configuration.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "yakable.turn-execution")
public record TurnExecutionProperties(
        Boolean recoveryEnabled,
        Duration recoveryInterval,
        Duration runningTimeout,
        Integer recoveryBatchSize
) {

    private static final Duration DEFAULT_RECOVERY_INTERVAL =
            Duration.ofSeconds(5);
    private static final Duration DEFAULT_RUNNING_TIMEOUT =
            Duration.ofMinutes(10);
    private static final int DEFAULT_RECOVERY_BATCH_SIZE = 100;

    public TurnExecutionProperties {
        recoveryEnabled = recoveryEnabled == null
                ? Boolean.TRUE
                : recoveryEnabled;
        recoveryInterval = positiveOrDefault(
                recoveryInterval,
                DEFAULT_RECOVERY_INTERVAL,
                "recoveryInterval"
        );
        runningTimeout = positiveOrDefault(
                runningTimeout,
                DEFAULT_RUNNING_TIMEOUT,
                "runningTimeout"
        );
        recoveryBatchSize = recoveryBatchSize == null
                ? DEFAULT_RECOVERY_BATCH_SIZE
                : recoveryBatchSize;

        if (recoveryBatchSize <= 0) {
            throw new IllegalArgumentException(
                    "recoveryBatchSize must be greater than zero"
            );
        }
    }

    private static Duration positiveOrDefault(
            Duration value,
            Duration defaultValue,
            String field
    ) {
        if (value == null) {
            return defaultValue;
        }
        if (value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException(
                    field + " must be positive"
            );
        }
        return value;
    }
}
