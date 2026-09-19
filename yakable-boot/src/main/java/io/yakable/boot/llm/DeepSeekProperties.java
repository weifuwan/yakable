package io.yakable.boot.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "yakable.llm.deepseek")
public record DeepSeekProperties(
        String apiKey,
        String baseUrl
) {

    public DeepSeekProperties {
        apiKey = apiKey == null ? "" : apiKey.strip();
        baseUrl = normalizeBaseUrl(baseUrl);
    }

    private static String normalizeBaseUrl(String value) {
        String normalized = value == null ? "" : value.strip();
        if (normalized.isEmpty()) {
            return "https://api.deepseek.com";
        }
        return normalized.replaceAll("/+$", "");
    }
}
