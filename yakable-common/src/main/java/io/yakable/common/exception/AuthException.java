package io.yakable.common.exception;

import io.yakable.common.ErrorCode;

/**
 * Auth 领域业务异常。
 */
public class AuthException extends BusinessException {

    public AuthException(ErrorCode errorCode) {
        super(errorCode);
    }
}
