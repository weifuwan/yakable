package io.yakable.common.exception;

/**
 * Session 已存在进行中的 Turn。
 */
public class SessionBusyException extends BusinessException {

    public SessionBusyException(String sessionId) {
        super("Session already has an active turn: " + sessionId);
    }
}
