package io.yakable.core.session;

public class TurnNotFoundException extends RuntimeException {

    public TurnNotFoundException(String turnId) {
        super("Turn not found: " + turnId);
    }
}
