package io.yakable.domain.session;

public final class SessionInactiveException extends RuntimeException {

    public SessionInactiveException(String sessionId) {
        super("Session is not active: " + sessionId);
    }
}
