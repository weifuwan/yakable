package io.yakable.domain.session;

import java.time.Instant;
import java.util.Objects;

public record Turn(
        String id,
        String sessionId,
        TurnStatus status,
        int attemptCount,
        String errorMessage,
        Instant startedAt,
        Instant finishedAt,
        Instant createdAt,
        Instant updatedAt
) {

    public Turn {
        id = requireText(id, "id");
        sessionId = requireText(sessionId, "sessionId");
        Objects.requireNonNull(status, "status");
        if (attemptCount < 0) {
            throw new IllegalArgumentException(
                    "attemptCount must not be negative"
            );
        }
        errorMessage = normalizeOptionalText(errorMessage);
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");

        validateExecutionState(
                status,
                attemptCount,
                errorMessage,
                startedAt,
                finishedAt,
                createdAt
        );
    }

    public Turn markRunning(Instant now) {
        requireStatus(TurnStatus.PENDING, TurnStatus.RUNNING);
        Instant started = Objects.requireNonNull(now, "now");
        return new Turn(
                id,
                sessionId,
                TurnStatus.RUNNING,
                attemptCount + 1,
                null,
                started,
                null,
                createdAt,
                started
        );
    }

    public Turn markSucceeded(Instant now) {
        requireStatus(TurnStatus.RUNNING, TurnStatus.SUCCEEDED);
        Instant finished = Objects.requireNonNull(now, "now");
        return new Turn(
                id,
                sessionId,
                TurnStatus.SUCCEEDED,
                attemptCount,
                null,
                startedAt,
                finished,
                createdAt,
                finished
        );
    }

    public Turn markFailed(String errorMessage, Instant now) {
        requireStatus(TurnStatus.RUNNING, TurnStatus.FAILED);
        Instant finished = Objects.requireNonNull(now, "now");
        return new Turn(
                id,
                sessionId,
                TurnStatus.FAILED,
                attemptCount,
                requireText(errorMessage, "errorMessage"),
                startedAt,
                finished,
                createdAt,
                finished
        );
    }

    public Turn recoverToPending(Instant now) {
        requireStatus(TurnStatus.RUNNING, TurnStatus.PENDING);
        Instant recoveredAt = Objects.requireNonNull(now, "now");
        return new Turn(
                id,
                sessionId,
                TurnStatus.PENDING,
                attemptCount,
                null,
                null,
                null,
                createdAt,
                recoveredAt
        );
    }

    private void requireStatus(
            TurnStatus expected,
            TurnStatus target
    ) {
        if (status != expected) {
            throw new IllegalStateException(
                    "Cannot transition turn from "
                            + status
                            + " to "
                            + target
            );
        }
    }

    private static void validateExecutionState(
            TurnStatus status,
            int attemptCount,
            String errorMessage,
            Instant startedAt,
            Instant finishedAt,
            Instant createdAt
    ) {
        switch (status) {
            case PENDING -> {
                if (errorMessage != null
                        || startedAt != null
                        || finishedAt != null) {
                    throw new IllegalArgumentException(
                            "PENDING turn cannot contain execution result state"
                    );
                }
            }
            case RUNNING -> {
                requireAttempt(attemptCount, status);
                if (errorMessage != null
                        || startedAt == null
                        || finishedAt != null) {
                    throw new IllegalArgumentException(
                            "RUNNING turn requires startedAt only"
                    );
                }
                validateStartedAt(createdAt, startedAt);
            }
            case SUCCEEDED -> {
                requireAttempt(attemptCount, status);
                if (errorMessage != null
                        || startedAt == null
                        || finishedAt == null) {
                    throw new IllegalArgumentException(
                            "SUCCEEDED turn requires execution timestamps"
                    );
                }
                validateStartedAt(createdAt, startedAt);
                validateFinishedAt(startedAt, finishedAt);
            }
            case FAILED -> {
                requireAttempt(attemptCount, status);
                if (errorMessage == null
                        || startedAt == null
                        || finishedAt == null) {
                    throw new IllegalArgumentException(
                            "FAILED turn requires error and execution timestamps"
                    );
                }
                validateStartedAt(createdAt, startedAt);
                validateFinishedAt(startedAt, finishedAt);
            }
        }
    }

    private static void requireAttempt(
            int attemptCount,
            TurnStatus status
    ) {
        if (attemptCount <= 0) {
            throw new IllegalArgumentException(
                    status + " turn requires at least one attempt"
            );
        }
    }

    private static void validateStartedAt(
            Instant createdAt,
            Instant startedAt
    ) {
        if (startedAt.isBefore(createdAt)) {
            throw new IllegalArgumentException(
                    "startedAt must not be before createdAt"
            );
        }
    }

    private static void validateFinishedAt(
            Instant startedAt,
            Instant finishedAt
    ) {
        if (finishedAt.isBefore(startedAt)) {
            throw new IllegalArgumentException(
                    "finishedAt must not be before startedAt"
            );
        }
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    field + " must not be blank"
            );
        }
        return normalized;
    }

    private static String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.strip();
        return normalized.isEmpty() ? null : normalized;
    }
}
