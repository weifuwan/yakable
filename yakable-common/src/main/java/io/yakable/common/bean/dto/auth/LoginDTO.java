package io.yakable.common.bean.dto.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 用户登录参数。
 *
 * @param username 用户名
 * @param password 密码
 */
@Schema(description = "用户登录参数")
public record LoginDTO(
        @Schema(description = "用户名") @NotBlank @Size(max = 64) String username,
        @Schema(description = "密码") @NotBlank @Size(max = 64) String password) {
}
