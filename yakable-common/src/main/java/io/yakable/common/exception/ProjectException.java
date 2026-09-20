package io.yakable.common.exception;

import io.yakable.common.ErrorCode;

/**
 * Project 领域业务异常。
 */
public class ProjectException extends BusinessException {

    public ProjectException(ErrorCode errorCode) {
        super(errorCode);
    }
}
