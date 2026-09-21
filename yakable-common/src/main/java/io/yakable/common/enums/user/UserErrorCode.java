package io.yakable.common.enums.user;

import io.yakable.common.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * User 领域错误码。
 */
@Getter
@RequiredArgsConstructor
public enum UserErrorCode implements ErrorCode {

    NOT_FOUND(40001, "User not found"),
    USERNAME_EXISTS(40002, "Username already exists"),
    CANNOT_OPERATE_SELF(40003, "Cannot perform this operation on yourself"),
    LAST_ACTIVE_ADMIN(40004, "At least one active administrator is required"),
    CURRENT_PASSWORD_INCORRECT(40005, "Current password is incorrect"),
    PASSWORD_CONFIRMATION_MISMATCH(40006, "Password confirmation does not match"),
    STATUS_CHANGED(40007, "User status has changed");

    private final Integer code;
    private final String message;
}
