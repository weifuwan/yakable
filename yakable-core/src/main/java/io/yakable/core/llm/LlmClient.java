package io.yakable.core.llm;

/**
 * LLM 统一调用入口。
 */
public interface LlmClient {

    /**
     * 发起一次非流式 LLM 调用。
     */
    LlmResponse chat(LlmRequest request);
}
