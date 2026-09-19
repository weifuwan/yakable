package io.yakable.domain.session;

public final class TurnNotFoundException extends RuntimeException {

    public TurnNotFoundException(String turnId) {
        super("Turn not found: " + turnId);
    }
}
