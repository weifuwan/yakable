package io.yakable.common.bean.dto.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * 撤销用户全部登录 Session 参数。
 *
 * @param userId 用户ID
 * @param operatorId 操作人ID
 */
public record RevokeUserSessionsDTO(
        @NotBlank String userId,
        @NotBlank String operatorId) {
}
