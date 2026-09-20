package io.yakable.common.exception;

/**
 * Session 当前不可用。
 */
public class SessionInactiveException extends BusinessException {

    public SessionInactiveException(String sessionId) {
        super("Session is not active: " + sessionId);
    }
}
