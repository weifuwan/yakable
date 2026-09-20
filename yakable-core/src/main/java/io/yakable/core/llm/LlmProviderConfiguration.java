package io.yakable.core.llm;

import io.yakable.common.utils.StringUtils;

/**
 * LLM Provider 运行时配置。
 *
 * @param apiKey Provider API Key
 * @param baseUrl Provider Base URL
 */
public record LlmProviderConfiguration(String apiKey, String baseUrl) {

    public LlmProviderConfiguration {
        apiKey = StringUtils.stripToEmpty(apiKey);
        baseUrl = StringUtils.stripTrailingSlash(baseUrl);
    }
}
