package io.yakable.core.session;

public enum TurnStatus {
    PENDING,
    RUNNING,
    SUCCEEDED,
    FAILED;

    public boolean active() {
        return this == PENDING || this == RUNNING;
    }
}
