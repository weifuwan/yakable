package io.yakable.boot.project;

import io.yakable.core.project.ProjectQueryService;
import io.yakable.core.project.ProjectSummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectQueryService projectQueryService;

    public ProjectController(ProjectQueryService projectQueryService) {
        this.projectQueryService = projectQueryService;
    }

    @GetMapping
    public List<ProjectResponse> listProjects() {
        return projectQueryService.listProjects().stream()
                .map(ProjectResponse::from)
                .toList();
    }

    public record ProjectResponse(
            String id,
            String name,
            Instant updatedAt
    ) {

        static ProjectResponse from(ProjectSummary project) {
            return new ProjectResponse(
                    project.id(),
                    project.name(),
                    project.updatedAt()
            );
        }
    }
}
