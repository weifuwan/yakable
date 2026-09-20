package io.yakable.core.llm;

import java.util.Optional;
import java.util.function.Consumer;

/**
 * LLM 统一调用入口。
 */
public interface LlmClient {

    /**
     * 查询模型上下文元数据。
     */
    Optional<LlmModelMetadata> modelMetadata(String provider, String model);

    /**
     * 估算一次 LLM 请求占用的输入 Token。
     */
    long estimateTokens(LlmRequest request);

    /**
     * 发起一次非流式 LLM 调用。
     */
    LlmResponse chat(LlmRequest request);

    /**
     * 发起一次流式 LLM 调用。
     */
    void streamingChat(LlmRequest request, Consumer<LlmStreamEvent> consumer);
}
