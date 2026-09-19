package io.yakable.plugin.model.api;

/**
 * Stable model plugin contract.
 *
 * <p>Implementations are discovered through Java ServiceLoader. Built-in plugins
 * use AutoService to generate the service registration at compile time.
 */
public interface ModelPlugin {

    ModelPluginDescriptor descriptor();

    default String provider() {
        return descriptor().provider();
    }

    LlmResponse chat(
            ModelPluginConfiguration configuration,
            LlmRequest request
    );
}
