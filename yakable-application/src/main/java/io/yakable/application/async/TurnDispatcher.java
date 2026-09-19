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

    /**
     * Protects committed business state from any dispatcher implementation
     * that unexpectedly throws.
     */
    default boolean dispatchSafely(String turnId) {
        try {
            return dispatch(turnId);
        } catch (RuntimeException ignored) {
            return false;
        }
    }
}
