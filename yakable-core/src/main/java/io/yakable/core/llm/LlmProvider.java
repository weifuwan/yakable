package io.yakable.core.llm;

import java.util.function.Consumer;

/**
 * LLM Provider 统一契约。
 */
public interface LlmProvider {

    /**
     * Provider 唯一标识。
     */
    String provider();

    /**
     * 使用 Provider 完成一次非流式 LLM 调用。
     */
    LlmResponse chat(LlmProviderConfiguration configuration, LlmRequest request);

    /**
     * 使用 Provider 完成一次流式 LLM 调用。
     */
    void streamingChat(
            LlmProviderConfiguration configuration, LlmRequest request, Consumer<LlmStreamEvent> consumer);
}
