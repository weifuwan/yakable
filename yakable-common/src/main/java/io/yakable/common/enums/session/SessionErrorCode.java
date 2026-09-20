package io.yakable.common.enums.session;

import io.yakable.common.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Session 领域错误码。
 */
@Getter
@RequiredArgsConstructor
public enum SessionErrorCode implements ErrorCode {

    NOT_FOUND(10001, "Session not found"),
    BUSY(10002, "Session already has an active turn"),
    INACTIVE(10003, "Session is not active"),
    CONTEXT_TOO_LARGE(10004, "Current message exceeds model context window");

    private final Integer code;
    private final String message;
}
