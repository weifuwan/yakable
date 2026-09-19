package io.yakable.application.async;

@FunctionalInterface
public interface TurnDispatcher {

    void dispatch(String turnId);
}
