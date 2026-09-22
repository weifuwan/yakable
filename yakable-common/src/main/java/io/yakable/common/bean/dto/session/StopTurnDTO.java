package io.yakable.common.bean.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 停止 Turn 入参。
 */
@Schema(description = "停止 Turn 参数")
public record StopTurnDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(description = "Session ID") @NotBlank String sessionId,
        @Schema(description = "Turn ID") @NotBlank String turnId,
        @Schema(hidden = true) @NotBlank String userId) {
}
