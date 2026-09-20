package io.yakable.common.enums.common;

import io.yakable.common.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 通用错误码。
 */
@Getter
@RequiredArgsConstructor
public enum CommonErrorCode implements ErrorCode {

    SUCCESS(0, "Success"),
    PARAM_NOT_VALID(40000, "Invalid request"),
    RESOURCE_NOT_EXISTS(40400, "Resource not found"),
    RESOURCE_DUPLICATION(40900, "Resource already exists"),
    COMMON_FAIL(50000, "Internal server error");

    private final Integer code;
    private final String message;
}
