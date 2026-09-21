package io.yakable.boot.controller.project;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.yakable.common.Result;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.service.project.ProjectService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
            @RequestParam(defaultValue = "50") int pageSize,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(
                projectService.queryProject(new QueryProjectPageDTO(current, pageSize, currentUser.getId())));
    }

    @Operation(summary = "查询 Project")
    @GetMapping("/{projectId}")
    public Result<ProjectDetailVO> queryProject(
            @PathVariable String projectId,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(projectService.queryProject(new QueryProjectDTO(projectId, currentUser.getId())));
    }

    @Operation(summary = "新增 Project")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Result<ProjectDetailVO> addProject(
            @Valid @RequestBody AddProjectDTO dto,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(
                projectService.addProject(new AddProjectDTO(currentUser.getId(), dto.prompt(), dto.model())));
    }
}
