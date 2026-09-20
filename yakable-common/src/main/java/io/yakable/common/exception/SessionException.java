package io.yakable.common.exception;

import io.yakable.common.ErrorCode;

/**
 * Session 领域业务异常。
 */
public class SessionException extends BusinessException {

    public SessionException(ErrorCode errorCode) {
        super(errorCode);
    }
}
