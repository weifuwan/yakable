package io.yakable.common.bean.dto.session;

import jakarta.validation.constraints.NotBlank;

/**
 * 新增 Session 入参。
 */
public record AddSessionDTO(
        @NotBlank String projectId,
        @NotBlank String title,
        @NotBlank String provider,
        @NotBlank String model,
        @NotBlank String content) {
}
