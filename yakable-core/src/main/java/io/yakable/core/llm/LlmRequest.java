package io.yakable.core.llm;

import io.yakable.common.utils.StringUtils;

import java.util.List;
import java.util.Objects;

/**
 * LLM 统一请求。
 *
 * @param provider Provider 标识
 * @param model 模型名称
 * @param system System Prompt，可为空
 * @param messages 会话消息
 */
public record LlmRequest(String provider, String model, String system, List<LlmMessage> messages) {

    public LlmRequest {
        StringUtils.requireText(provider, "provider");
        StringUtils.requireText(model, "model");
        if (system != null) {
            StringUtils.requireText(system, "system");
        }
        Objects.requireNonNull(messages, "messages");
        messages = List.copyOf(messages);
        if (messages.isEmpty()) {
            throw new IllegalArgumentException("messages must not be empty");
        }
    }
}
