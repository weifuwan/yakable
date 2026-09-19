package io.yakable.domain.session;

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

        if (status != TurnStatus.FAILED && errorMessage != null) {
            throw new IllegalArgumentException(
                    "Only FAILED turns may contain an error message"
            );
        }
        if (status == TurnStatus.FAILED && errorMessage == null) {
            throw new IllegalArgumentException(
                    "FAILED turn requires an error message"
            );
        }
    }

    public Turn markRunning(Instant now) {
        requireStatus(TurnStatus.PENDING, TurnStatus.RUNNING);
        return withStatus(TurnStatus.RUNNING, null, now);
    }

    public Turn markSucceeded(Instant now) {
        requireStatus(TurnStatus.RUNNING, TurnStatus.SUCCEEDED);
        return withStatus(TurnStatus.SUCCEEDED, null, now);
    }

    public Turn markFailed(String errorMessage, Instant now) {
        requireStatus(TurnStatus.RUNNING, TurnStatus.FAILED);
        return withStatus(
                TurnStatus.FAILED,
                requireText(errorMessage, "errorMessage"),
                now
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
