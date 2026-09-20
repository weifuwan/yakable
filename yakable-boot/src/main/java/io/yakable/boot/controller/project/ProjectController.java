package io.yakable.boot.controller.project;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.PageDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.service.project.ProjectService;
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
    public PageData<ProjectListVO> queryProject(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "50") int pageSize) {
        return projectService.queryProject(new PageDTO(current, pageSize));
    }

    @GetMapping("/{projectId}")
    public ProjectDetailVO queryProject(@PathVariable String projectId) {
        return projectService.queryProject(new QueryProjectDTO(projectId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
    }

    @PostMapping
    public ResponseEntity<ProjectDetailVO> addProject(@Valid @RequestBody AddProjectDTO dto) {
        ProjectDetailVO project = projectService.addProject(dto);
        return ResponseEntity.created(URI.create("/api/projects/" + project.getId())).body(project);
    }
}
