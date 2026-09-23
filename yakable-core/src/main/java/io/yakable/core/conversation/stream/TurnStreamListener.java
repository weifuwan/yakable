package io.yakable.core.conversation.stream;

/**
 * Turn 流式输出监听器。
 */
public interface TurnStreamListener {

    void onSnapshot(String content);

    void onDelta(String content);

    void onComplete();

    void onError(String message);

    void onStopped();
}
