package io.yakable.core.session;

import java.time.Instant;
import java.util.Objects;

public record Turn(
        String id,
        String sessionId,
        TurnStatus status,
        String errorMessage,
        Instant createdAt,
        Instant updatedAt
) {

    public Turn {
        id = requireText(id, "id");
        sessionId = requireText(sessionId, "sessionId");
        Objects.requireNonNull(status, "status");
        errorMessage = normalizeOptionalText(errorMessage);
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }

    public Turn markRunning(Instant now) {
        return withStatus(TurnStatus.RUNNING, null, now);
    }

    public Turn markSucceeded(Instant now) {
        return withStatus(TurnStatus.SUCCEEDED, null, now);
    }

    public Turn markFailed(String errorMessage, Instant now) {
        return withStatus(TurnStatus.FAILED, errorMessage, now);
    }

    private Turn withStatus(
            TurnStatus nextStatus,
            String nextErrorMessage,
            Instant now
    ) {
        return new Turn(
                id,
                sessionId,
                nextStatus,
                nextErrorMessage,
                createdAt,
                Objects.requireNonNull(now, "now")
        );
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
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
