package io.yakable.common.bean.dto.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * 新增登录 Session 参数。
 *
 * @param userId 用户ID
 */
public record AddAuthSessionDTO(@NotBlank String userId) {
}
