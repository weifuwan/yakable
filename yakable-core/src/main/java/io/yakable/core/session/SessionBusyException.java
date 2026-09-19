package io.yakable.core.session;

public final class SessionBusyException extends RuntimeException {

    public SessionBusyException(String sessionId) {
        super("Session already has an active turn: " + sessionId);
    }
}
