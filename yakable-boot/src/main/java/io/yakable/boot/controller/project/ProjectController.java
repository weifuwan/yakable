package io.yakable.boot.controller.project;

import io.yakable.service.project.ProjectService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public ProjectService.ProjectPage listProjects(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "50") int pageSize
    ) {
        return projectService.listProjects(current, pageSize);
    }

    @GetMapping("/{projectId}")
    public ProjectService.ProjectDetails getProject(
            @PathVariable String projectId
    ) {
        return projectService.getProject(projectId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Project not found"
                ));
    }

    @PostMapping
    public ResponseEntity<ProjectService.ProjectDetails> createProject(
            @Valid @RequestBody CreateProjectRequest request
    ) {
        ProjectService.ProjectDetails project =
                projectService.createProject(
                        request.prompt(),
                        request.model().provider(),
                        request.model().model()
                );

        return ResponseEntity
                .created(URI.create(
                        "/api/projects/" + project.id()
                ))
                .body(project);
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
}
