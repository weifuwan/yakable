package io.yakable.core.llm;

import java.util.function.Consumer;

/**
 * LLM 统一调用入口。
 */
public interface LlmClient {

    /**
     * 发起一次非流式 LLM 调用。
     */
    LlmResponse chat(LlmRequest request);

    /**
     * 发起一次流式 LLM 调用。
     */
    void streamingChat(LlmRequest request, Consumer<LlmStreamEvent> consumer);
}
