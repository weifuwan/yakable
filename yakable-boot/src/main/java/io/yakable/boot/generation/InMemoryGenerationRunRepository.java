package io.yakable.boot.generation;

import io.yakable.core.generation.GenerationRun;
import io.yakable.core.generation.GenerationRunRepository;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

final class InMemoryGenerationRunRepository implements GenerationRunRepository {

    private final ConcurrentMap<String, GenerationRun> activeRunsByProject = new ConcurrentHashMap<>();

    @Override
    public Optional<GenerationRun> findActiveByProjectId(String projectId) {
        GenerationRun run = activeRunsByProject.get(projectId);
        return run != null && run.isActive() ? Optional.of(run) : Optional.empty();
    }

    @Override
    public GenerationRun save(GenerationRun run) {
        if (run.isActive()) {
            activeRunsByProject.put(run.projectId(), run);
        }
        return run;
    }
}
