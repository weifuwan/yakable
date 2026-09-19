package io.yakable.application.async;

@FunctionalInterface
public interface TurnDispatcher {

    /**
     * Best-effort low-latency dispatch.
     *
     * <p>Durable execution is owned by persisted PENDING Turns. Implementations
     * should return false for transient scheduling failures.</p>
     */
    boolean dispatch(String turnId);
}
