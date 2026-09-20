package io.yakable.core.llm;

import io.yakable.common.utils.StringUtils;

/**
 * LLM 统一响应。
 *
 * @param provider 实际 Provider
 * @param model 实际模型
 * @param content Assistant 文本
 * @param usage Token 使用量
 * @param providerRequestId Provider 请求 ID
 * @param finishReason 结束原因
 */
public record LlmResponse(
        String provider, String model, String content, LlmUsage usage, String providerRequestId, String finishReason) {

    public LlmResponse {
        StringUtils.requireText(provider, "provider");
        StringUtils.requireText(model, "model");
        StringUtils.requireText(content, "content");
        usage = usage == null ? new LlmUsage(null, null, null) : usage;
    }
}
