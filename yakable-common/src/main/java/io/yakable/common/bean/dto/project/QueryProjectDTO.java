package io.yakable.common.bean.dto.project;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 查询单个 Project 入参。
 *
 * @param projectId Project ID
 */
@Schema(description = "查询 Project 参数")
public record QueryProjectDTO(
        @Schema(description = "Project ID") @NotBlank String projectId) {}
