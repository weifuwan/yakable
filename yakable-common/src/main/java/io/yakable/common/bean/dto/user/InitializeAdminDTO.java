package io.yakable.common.bean.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 初始化管理员参数。
 *
 * @param username 用户名
 * @param name 用户名称
 * @param password 初始密码
 */
public record InitializeAdminDTO(
        @NotBlank @Size(max = 64) String username,
        @NotBlank @Size(max = 64) String name,
        @NotBlank @Size(min = 8, max = 64) String password) {
}
