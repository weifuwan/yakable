package io.yakable.boot.configuration.properties;

import io.yakable.plugin.model.api.ModelPluginConfiguration;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Locale;
import java.util.Map;

@ConfigurationProperties(prefix = "yakable.model")
public record ModelProperties(
        Map<String, Provider> providers
) {

    public ModelProperties {
        providers = providers == null
                ? Map.of()
                : Map.copyOf(providers);
    }

    public ModelPluginConfiguration resolve(String provider) {
        if (provider == null || provider.isBlank()) {
            return new ModelPluginConfiguration("", "");
        }

        Provider properties = providers.get(
                provider.trim().toLowerCase(Locale.ROOT)
        );
        if (properties == null) {
            return new ModelPluginConfiguration("", "");
        }

        return new ModelPluginConfiguration(
                properties.apiKey(),
                properties.baseUrl()
        );
    }

    public record Provider(
            String apiKey,
            String baseUrl
    ) {

        public Provider {
            apiKey = apiKey == null ? "" : apiKey.strip();
            baseUrl = baseUrl == null ? "" : baseUrl.strip();
        }
    }
}
