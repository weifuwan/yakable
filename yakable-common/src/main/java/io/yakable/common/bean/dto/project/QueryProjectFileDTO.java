package io.yakable.common.bean.dto.project;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 查询 Project 单个已发布文件入参。
 *
 * @param projectId Project ID
 * @param path Project Root 内相对路径
 * @param userId 当前用户ID
 */
@Schema(description = "查询 Project 文件内容参数")
public record QueryProjectFileDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(description = "Project Root 内相对路径") @NotBlank String path,
        @Schema(hidden = true) @NotBlank String userId) {
}
