package io.yakable.boot.controller.project;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.common.PageDTO;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.service.project.ProjectService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Resource
    private ProjectService projectService;

    @GetMapping
    public PageData<ProjectListVO> queryProject(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "50") int pageSize) {
        return projectService.queryProject(new PageDTO(current, pageSize));
    }

    @GetMapping("/{projectId}")
    public ProjectDetailVO queryProject(@PathVariable String projectId) {
        return projectService.queryProject(new QueryProjectDTO(projectId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDetailVO addProject(@Valid @RequestBody AddProjectDTO dto) {
        return projectService.addProject(dto);
    }
}
