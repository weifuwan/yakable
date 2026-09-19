package io.yakable.interfaces.rest.project;

import io.yakable.application.project.ProjectBootstrapService;
import io.yakable.application.project.ProjectDetails;
import io.yakable.application.project.ProjectOverviewQueryService;
import io.yakable.application.project.ProjectStartResult;
import io.yakable.application.project.ProjectSummary;
import io.yakable.application.project.StartProjectCommand;
import io.yakable.domain.project.ProjectStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectBootstrapService bootstrapService;
    private final ProjectOverviewQueryService queryService;

    public ProjectController(
            ProjectBootstrapService bootstrapService,
            ProjectOverviewQueryService queryService
    ) {
        this.bootstrapService = bootstrapService;
        this.queryService = queryService;
    }

    @GetMapping
    public List<ProjectSummaryResponse> listProjects() {
        return queryService.listProjects().stream()
                .map(ProjectSummaryResponse::from)
                .toList();
    }

    @GetMapping("/{projectId}")
    public ProjectDetailsResponse getProject(
            @PathVariable String projectId
    ) {
        return queryService.getProject(projectId)
                .map(ProjectDetailsResponse::from)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Project not found"
                ));
    }

    @PostMapping
    public ResponseEntity<ProjectDetailsResponse> createProject(
            @Valid @RequestBody CreateProjectRequest request
    ) {
        ProjectStartResult result =
                bootstrapService.startProject(new StartProjectCommand(
                        request.prompt(),
                        request.model().provider(),
                        request.model().model()
                ));

        return ResponseEntity
                .created(URI.create(
                        "/api/projects/" + result.project().id()
                ))
                .body(ProjectDetailsResponse.from(result));
    }

    public record CreateProjectRequest(
            @NotBlank String prompt,
            @NotNull @Valid ModelRequest model
    ) {
    }

    public record ModelRequest(
            @NotBlank String provider,
            @NotBlank String model
    ) {
    }

    public record ProjectSummaryResponse(
            String id,
            String name,
            String latestSessionId,
            Instant updatedAt
    ) {

        static ProjectSummaryResponse from(
                ProjectSummary project
        ) {
            return new ProjectSummaryResponse(
                    project.id(),
                    project.name(),
                    project.latestSessionId(),
                    project.updatedAt()
            );
        }
    }

    public record ProjectDetailsResponse(
            String id,
            String name,
            String latestSessionId,
            ProjectStatus status,
            Instant createdAt,
            Instant updatedAt
    ) {

        static ProjectDetailsResponse from(
                ProjectDetails project
        ) {
            return new ProjectDetailsResponse(
                    project.id(),
                    project.name(),
                    project.latestSessionId(),
                    project.status(),
                    project.createdAt(),
                    project.updatedAt()
            );
        }

        static ProjectDetailsResponse from(
                ProjectStartResult result
        ) {
            return new ProjectDetailsResponse(
                    result.project().id(),
                    result.project().name(),
                    result.session().id(),
                    result.project().status(),
                    result.project().createdAt(),
                    result.session().updatedAt()
            );
        }
    }
}
