package io.yakable.boot.controller.project;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.yakable.common.Result;
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

@Tag(name = "Project", description = "Project 管理")
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Resource
    private ProjectService projectService;

    @Operation(summary = "分页查询 Project")
    @GetMapping
    public Result<PageData<ProjectListVO>> queryProject(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "50") int pageSize) {
        return Result.success(projectService.queryProject(new PageDTO(current, pageSize)));
    }

    @Operation(summary = "查询 Project 详情")
    @GetMapping("/{projectId}")
    public Result<ProjectDetailVO> queryProject(@PathVariable String projectId) {
        return Result.success(projectService.queryProject(new QueryProjectDTO(projectId)));
    }

    @Operation(summary = "新增 Project")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Result<ProjectDetailVO> addProject(@Valid @RequestBody AddProjectDTO dto) {
        return Result.success(projectService.addProject(dto));
    }
}
