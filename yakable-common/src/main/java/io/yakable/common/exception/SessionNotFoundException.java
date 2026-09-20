package io.yakable.common.exception;

/**
 * Session 不存在。
 */
public class SessionNotFoundException extends BusinessException {

    public SessionNotFoundException(String sessionId) {
        super("Session not found: " + sessionId);
    }
}
