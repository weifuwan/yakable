package io.yakable.plugin.model.api;

public record ModelPluginConfiguration(
        String apiKey,
        String baseUrl
) {

    public ModelPluginConfiguration {
        apiKey = apiKey == null ? "" : apiKey.strip();
        baseUrl = baseUrl == null ? "" : baseUrl.strip().replaceAll("/+$", "");
    }
}
