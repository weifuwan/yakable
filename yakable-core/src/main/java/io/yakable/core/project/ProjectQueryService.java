package io.yakable.core.project;

import io.yakable.core.session.Session;
import io.yakable.core.session.SessionRepository;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class ProjectQueryService {

    private final ProjectRepository projectRepository;
    private final SessionRepository sessionRepository;

    public ProjectQueryService(
            ProjectRepository projectRepository,
            SessionRepository sessionRepository
    ) {
        this.projectRepository = Objects.requireNonNull(projectRepository, "projectRepository");
        this.sessionRepository = Objects.requireNonNull(sessionRepository, "sessionRepository");
    }

    public List<ProjectSummary> listProjects() {
        return projectRepository.findAll().stream()
                .map(this::toSummary)
                .flatMap(Optional::stream)
                .sorted(Comparator.comparing(ProjectSummary::updatedAt).reversed())
                .toList();
    }

    public Optional<ProjectDetails> getProject(String projectId) {
        return projectRepository.findById(projectId)
                .flatMap(project -> latestSession(project.id())
                        .map(session -> toDetails(project, session)));
    }

    private Optional<ProjectSummary> toSummary(Project project) {
        return latestSession(project.id())
                .map(session -> new ProjectSummary(
                        project.id(),
                        project.name(),
                        session.id(),
                        latest(project.updatedAt(), session.updatedAt())
                ));
    }

    private ProjectDetails toDetails(Project project, Session session) {
        return new ProjectDetails(
                project.id(),
                project.name(),
                session.id(),
                project.status(),
                project.createdAt(),
                latest(project.updatedAt(), session.updatedAt())
        );
    }

    private Optional<Session> latestSession(String projectId) {
        return sessionRepository.findByProjectId(projectId).stream()
                .max(Comparator.comparing(Session::updatedAt));
    }

    private static Instant latest(Instant left, Instant right) {
        return left.isAfter(right) ? left : right;
    }
}
