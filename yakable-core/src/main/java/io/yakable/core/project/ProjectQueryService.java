package io.yakable.core.project;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class ProjectQueryService {

    private final ProjectRepository projectRepository;

    public ProjectQueryService(ProjectRepository projectRepository) {
        this.projectRepository = Objects.requireNonNull(projectRepository, "projectRepository");
    }

    public List<ProjectSummary> listProjects() {
        return projectRepository.findAll().stream()
                .sorted(Comparator.comparing(Project::updatedAt).reversed())
                .map(project -> new ProjectSummary(
                        project.id(),
                        project.name(),
                        project.updatedAt()
                ))
                .toList();
    }

    public Optional<Project> getProject(String projectId) {
        return projectRepository.findById(projectId);
    }
}
