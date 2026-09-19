package io.yakable.core.generation;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public final class GenerationService {

    private final GenerationRunRepository generationRunRepository;

    public GenerationService(GenerationRunRepository generationRunRepository) {
        this.generationRunRepository = Objects.requireNonNull(
                generationRunRepository,
                "generationRunRepository"
        );
    }

    public synchronized GenerationRun ensureRunning(String projectId) {
        Objects.requireNonNull(projectId, "projectId");

        return generationRunRepository.findActiveByProjectId(projectId)
                .orElseGet(() -> generationRunRepository.save(startRun(projectId)));
    }

    private static GenerationRun startRun(String projectId) {
        Instant now = Instant.now();

        return new GenerationRun(
                UUID.randomUUID().toString(),
                projectId,
                GenerationRun.Status.RUNNING,
                List.of(
                        new GenerationRun.Step(
                                GenerationRun.StepKey.PREPARING,
                                GenerationRun.StepStatus.RUNNING
                        ),
                        new GenerationRun.Step(
                                GenerationRun.StepKey.PLANNING,
                                GenerationRun.StepStatus.PENDING
                        ),
                        new GenerationRun.Step(
                                GenerationRun.StepKey.GENERATING,
                                GenerationRun.StepStatus.PENDING
                        ),
                        new GenerationRun.Step(
                                GenerationRun.StepKey.APPLYING,
                                GenerationRun.StepStatus.PENDING
                        )
                ),
                now,
                now
        );
    }
}
