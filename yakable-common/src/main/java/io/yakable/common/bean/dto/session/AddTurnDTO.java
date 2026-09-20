package io.yakable.common.bean.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 新增 Turn 入参。
 */
@Schema(description = "新增 Turn 参数")
public record AddTurnDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(description = "Session ID") @NotBlank String sessionId,
        @Schema(description = "用户输入内容") @NotBlank String content) {
}
