package io.yakable.common.bean.dto.project;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 查询 Project 已发布文件列表入参。
 *
 * @param projectId Project ID
 * @param userId 当前用户ID
 */
@Schema(description = "查询 Project 文件列表参数")
public record QueryProjectFilesDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(hidden = true) @NotBlank String userId) {
}
