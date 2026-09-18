package io.yakable.boot.project;

import io.yakable.core.project.Project;
import io.yakable.core.project.ProjectRepository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

final class InMemoryProjectRepository implements ProjectRepository {

    private final ConcurrentMap<String, Project> projects = new ConcurrentHashMap<>();

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
