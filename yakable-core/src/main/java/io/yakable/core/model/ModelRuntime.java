package io.yakable.core.model;

import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginConfiguration;

import java.util.Objects;

public final class ModelRuntime {

    private final ModelPluginRegistry registry;
    private final ModelPluginConfigurationResolver configurationResolver;

    public ModelRuntime(
            ModelPluginRegistry registry,
            ModelPluginConfigurationResolver configurationResolver
    ) {
        this.registry = Objects.requireNonNull(registry, "registry");
        this.configurationResolver = Objects.requireNonNull(
                configurationResolver,
                "configurationResolver"
        );
    }

    public LlmResponse chat(String provider, LlmRequest request) {
        ModelPlugin plugin = registry.require(provider);
        ModelPluginConfiguration configuration =
                configurationResolver.resolve(plugin.provider());

        if (configuration == null) {
            configuration = new ModelPluginConfiguration("", "");
        }

        return plugin.chat(configuration, request);
    }
}
