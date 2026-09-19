package io.yakable.core.generation;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

public record GenerationRun(
        String id,
        String projectId,
        Status status,
        List<Step> steps,
        Instant startedAt,
        Instant updatedAt
) {

    public GenerationRun {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(projectId, "projectId");
        Objects.requireNonNull(status, "status");
        steps = List.copyOf(steps);
        Objects.requireNonNull(startedAt, "startedAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }

    public boolean isActive() {
        return status == Status.RUNNING;
    }

    public enum Status {
        RUNNING,
        SUCCEEDED,
        FAILED
    }

    public enum StepKey {
        PREPARING,
        PLANNING,
        GENERATING,
        APPLYING
    }

    public enum StepStatus {
        PENDING,
        RUNNING,
        SUCCEEDED,
        FAILED
    }

    public record Step(
            StepKey key,
            StepStatus status
    ) {
        public Step {
            Objects.requireNonNull(key, "key");
            Objects.requireNonNull(status, "status");
        }
    }
}
