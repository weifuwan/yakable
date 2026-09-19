package io.yakable.infrastructure.persistence.memory.project;

import io.yakable.domain.project.Project;
import io.yakable.domain.project.repository.ProjectRepository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public final class InMemoryProjectRepository
        implements ProjectRepository {

    private final ConcurrentMap<String, Project> projects =
            new ConcurrentHashMap<>();

    @Override
    public Project save(Project project) {
        projects.put(project.id(), project);
        return project;
    }

    @Override
    public Optional<Project> findById(String projectId) {
        return Optional.ofNullable(projects.get(projectId));
    }

    @Override
    public List<Project> findAll() {
        return List.copyOf(projects.values());
    }
}
