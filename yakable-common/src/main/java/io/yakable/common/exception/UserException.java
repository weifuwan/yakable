package io.yakable.common.exception;

import io.yakable.common.ErrorCode;

/**
 * User 领域业务异常。
 */
public class UserException extends BusinessException {

    public UserException(ErrorCode errorCode) {
        super(errorCode);
    }

    public UserException(ErrorCode errorCode, Throwable cause) {
        super(errorCode, cause);
    }
}
