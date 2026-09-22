package io.yakable.service.session;

/**
 * Turn 流式输出监听器。
 */
public interface TurnStreamListener {

    /**
     * 当前已生成内容快照。
     */
    void onSnapshot(String content);

    /**
     * 新增流式内容。
     */
    void onDelta(String content);

    /**
     * Turn 成功完成。
     */
    void onComplete();

    /**
     * Turn 执行失败。
     */
    void onError(String message);

    /**
     * Turn 被用户停止。
     */
    void onStopped();
}
