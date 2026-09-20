package io.yakable.common.exception;

import io.yakable.common.ErrorCode;

/**
 * 统一业务异常。
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode == null ? null : errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public BusinessException(ErrorCode errorCode, Throwable cause) {
        super(errorCode == null ? null : errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }

    public BusinessException(String message) {
        super(message);
        this.errorCode = null;
    }

    public BusinessException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = null;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
