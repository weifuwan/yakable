package io.yakable.core.llm;

/**
 * LLM Token 使用量。
 *
 * @param inputTokens 输入 Token 数
 * @param outputTokens 输出 Token 数
 * @param totalTokens 总 Token 数
 */
public record LlmUsage(Long inputTokens, Long outputTokens, Long totalTokens) {
}
