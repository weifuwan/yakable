package io.yakable.common.enums.project;

import io.yakable.common.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Project 领域错误码。
 */
@Getter
@RequiredArgsConstructor
public enum ProjectErrorCode implements ErrorCode {

    NOT_FOUND(20001, "Project not found");

    private final Integer code;
    private final String message;
}
