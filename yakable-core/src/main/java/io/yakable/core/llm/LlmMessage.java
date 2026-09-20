package io.yakable.core.llm;

import io.yakable.common.utils.StringUtils;

import java.util.Objects;

/**
 * LLM 会话消息。
 *
 * @param role 消息角色
 * @param content 消息内容
 */
public record LlmMessage(Role role, String content) {

    public LlmMessage {
        Objects.requireNonNull(role, "role");
        StringUtils.requireText(content, "content");
    }

    /**
     * LLM 消息角色。
     */
    public enum Role {
        USER,
        ASSISTANT
    }
}
