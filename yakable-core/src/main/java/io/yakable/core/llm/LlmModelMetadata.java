package io.yakable.core.llm;

/**
 * LLM 模型上下文元数据。
 *
 * @param contextWindowTokens 模型最大上下文 Token
 * @param reservedOutputTokens 为本次输出预留的 Token
 */
public record LlmModelMetadata(long contextWindowTokens, long reservedOutputTokens) {

    public LlmModelMetadata {
        if (contextWindowTokens <= 0) {
            throw new IllegalArgumentException("contextWindowTokens must be greater than 0");
        }
        if (reservedOutputTokens < 0 || reservedOutputTokens >= contextWindowTokens) {
            throw new IllegalArgumentException("reservedOutputTokens must be between 0 and contextWindowTokens");
        }
    }

    /**
     * 当前请求可使用的最大输入 Token。
     */
    public long inputBudgetTokens() {
        return contextWindowTokens - reservedOutputTokens;
    }
}
