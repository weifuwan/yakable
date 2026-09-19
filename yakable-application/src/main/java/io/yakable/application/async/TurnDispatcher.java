package io.yakable.application.async;

@FunctionalInterface
public interface TurnDispatcher {

    /**
     * Best-effort low-latency dispatch.
     *
     * <p>Durable execution is owned by persisted PENDING Turns. A transient
     * dispatch failure must therefore return false instead of invalidating the
     * already committed business state.</p>
     */
    boolean dispatch(String turnId);
}
