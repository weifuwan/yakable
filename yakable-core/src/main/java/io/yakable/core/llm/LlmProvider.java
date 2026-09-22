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
     * 查询模型上下文元数据。
     *
     * <p>Provider 支持的模型必须提供确定的 Context 能力，不允许返回未知值。</p>
     */
    LlmModelMetadata modelMetadata(String model);

    /**
     * 估算一次 LLM 请求占用的输入 Token。
     */
    long estimateTokens(LlmRequest request);

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
