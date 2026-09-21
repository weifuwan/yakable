package io.yakable.common.bean.dto.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * 登录 Session Token 参数。
 *
 * @param token Session Token
 */
public record AuthTokenDTO(@NotBlank String token) {
}
