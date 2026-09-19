package io.yakable.plugin.model.api;

import java.util.Objects;
import java.util.Set;

public record ModelPluginDescriptor(
        String provider,
        String displayName,
        String apiVersion,
        Set<ModelCapability> capabilities
) {

    public static final String CURRENT_API_VERSION = "1";

    public ModelPluginDescriptor {
        provider = requireText(provider, "provider");
        displayName = requireText(displayName, "displayName");
        apiVersion = requireText(apiVersion, "apiVersion");
        Objects.requireNonNull(capabilities, "capabilities");
        capabilities = Set.copyOf(capabilities);
    }

    public boolean supports(ModelCapability capability) {
        return capabilities.contains(capability);
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return normalized;
    }
}
