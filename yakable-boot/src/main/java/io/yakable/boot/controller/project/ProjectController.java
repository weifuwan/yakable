package io.yakable.boot.controller.project;

import io.yakable.common.PageData;
import io.yakable.service.project.ProjectService;
import io.yakable.service.project.dto.AddProjectDTO;
import io.yakable.service.project.dto.QueryProjectDTO;
import io.yakable.service.project.dto.QueryProjectPageDTO;
import jakarta.validation.Valid;
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
    public PageData<ProjectService.ProjectSummary> queryProject(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "50") int pageSize
    ) {
        return projectService.queryProject(
                new QueryProjectPageDTO(current, pageSize)
        );
    }

    @GetMapping("/{projectId}")
    public ProjectService.ProjectDetails queryProject(
            @PathVariable String projectId
    ) {
        return projectService.queryProject(
                        new QueryProjectDTO(projectId)
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Project not found"
                ));
    }

    @PostMapping
    public ResponseEntity<ProjectService.ProjectDetails> addProject(
            @Valid @RequestBody AddProjectDTO dto
    ) {
        ProjectService.ProjectDetails project =
                projectService.addProject(dto);

        return ResponseEntity
                .created(URI.create(
                        "/api/projects/" + project.getId()
                ))
                .body(project);
    }
}
