package io.yakable.common.bean.dto.session;

import jakarta.validation.constraints.NotBlank;

/**
 * 新增 Turn 请求体。
 */
public record AddTurnRequestDTO(@NotBlank String content) {
}
