package io.yakable.common.enums.auth;

import io.yakable.common.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Auth 领域错误码。
 */
@Getter
@RequiredArgsConstructor
public enum AuthErrorCode implements ErrorCode {

    UNAUTHORIZED(30001, "Authentication required"),
    INVALID_CREDENTIALS(30002, "Invalid username or password"),
    ACCOUNT_DISABLED(30003, "Current account is disabled"),
    FORBIDDEN(30004, "Access denied");

    private final Integer code;
    private final String message;
}
