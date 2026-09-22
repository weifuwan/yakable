package io.yakable.common.bean.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 查询 Session Turn 导航索引入参。
 */
@Schema(description = "查询 Session Turn 导航索引参数")
public record QuerySessionTurnNavigationDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(description = "Session ID") @NotBlank String sessionId,
        @Schema(hidden = true) @NotBlank String userId) {
}
