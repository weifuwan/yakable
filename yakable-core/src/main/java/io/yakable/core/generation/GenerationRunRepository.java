package io.yakable.core.generation;

import java.util.Optional;

public interface GenerationRunRepository {

    Optional<GenerationRun> findActiveByProjectId(String projectId);

    GenerationRun save(GenerationRun run);
}
