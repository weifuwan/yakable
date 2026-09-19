package io.yakable.infrastructure.model;

import io.yakable.plugin.model.api.ModelPluginConfiguration;

@FunctionalInterface
public interface ModelPluginConfigurationResolver {

    ModelPluginConfiguration resolve(String provider);
}
