package io.yakable.boot.project;

import io.yakable.boot.session.SessionTurnDispatcher;
import io.yakable.core.project.StartProjectCommand;
import io.yakable.core.project.ProjectDetails;
import io.yakable.core.project.ProjectCommandService;
import io.yakable.core.project.ProjectQueryService;
import io.yakable.core.project.ProjectStartResult;
import io.yakable.core.project.ProjectStatus;
import io.yakable.core.project.ProjectSummary;
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

    private final ProjectCommandService projectCommandService;
    private final ProjectQueryService projectQueryService;
    private final SessionTurnDispatcher turnDispatcher;

    public ProjectController(
            ProjectCommandService projectCommandService,
            ProjectQueryService projectQueryService,
            SessionTurnDispatcher turnDispatcher
    ) {
        this.projectCommandService = projectCommandService;
        this.projectQueryService = projectQueryService;
        this.turnDispatcher = turnDispatcher;
    }

    @GetMapping
    public List<ProjectSummaryResponse> listProjects() {
        return projectQueryService.listProjects().stream()
                .map(ProjectSummaryResponse::from)
                .toList();
    }

    @GetMapping("/{projectId}")
    public ProjectDetailsResponse getProject(
            @PathVariable String projectId
    ) {
        return projectQueryService.getProject(projectId)
                .map(ProjectDetailsResponse::from)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Project not found"
                ));
    }

    @PostMapping
    public ResponseEntity<ProjectDetailsResponse> createProject(
            @RequestBody CreateProjectRequest request
    ) {
        StartProjectCommand command = toCommand(request);
        ProjectStartResult result =
                projectCommandService.startProject(command);

        turnDispatcher.dispatch(result.initialTurn().turn().id());

        return ResponseEntity
                .created(URI.create("/api/projects/" + result.project().id()))
                .body(ProjectDetailsResponse.from(result));
    }

    private static StartProjectCommand toCommand(
            CreateProjectRequest request
    ) {
        if (request == null || request.model() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "prompt and model are required"
            );
        }

        try {
            return new StartProjectCommand(
                    request.prompt(),
                    request.model().provider(),
                    request.model().model()
            );
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "prompt, provider, and model must not be blank",
                    exception
            );
        }
    }

    public record CreateProjectRequest(
            String prompt,
            ModelRequest model
    ) {
    }

    public record ModelRequest(
            String provider,
            String model
    ) {
    }

    public record ProjectSummaryResponse(
            String id,
            String name,
            String sessionId,
            Instant updatedAt
    ) {

        static ProjectSummaryResponse from(ProjectSummary project) {
            return new ProjectSummaryResponse(
                    project.id(),
                    project.name(),
                    project.sessionId(),
                    project.updatedAt()
            );
        }
    }

    public record ProjectDetailsResponse(
            String id,
            String name,
            String sessionId,
            ProjectStatus status,
            Instant createdAt,
            Instant updatedAt
    ) {

        static ProjectDetailsResponse from(ProjectDetails project) {
            return new ProjectDetailsResponse(
                    project.id(),
                    project.name(),
                    project.sessionId(),
                    project.status(),
                    project.createdAt(),
                    project.updatedAt()
            );
        }

        static ProjectDetailsResponse from(ProjectStartResult result) {
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
