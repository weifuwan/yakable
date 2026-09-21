package io.yakable.common.bean.dto.user;

import jakarta.validation.constraints.NotBlank;

/**
 * 查询用户参数。
 *
 * @param userId 用户ID
 */
public record QueryUserDTO(@NotBlank String userId) {
}
