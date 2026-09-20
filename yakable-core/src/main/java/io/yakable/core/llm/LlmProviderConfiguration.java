package io.yakable.core.llm;

/**
 * LLM Provider 运行时配置。
 */
public record LlmProviderConfiguration(String apiKey, String baseUrl) {

    public LlmProviderConfiguration {
        apiKey = apiKey == null ? "" : apiKey.strip();
        baseUrl = baseUrl == null ? "" : baseUrl.strip().replaceAll("/+$", "");
    }
}
