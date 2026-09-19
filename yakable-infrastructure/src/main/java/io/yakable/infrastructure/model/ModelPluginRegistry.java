package io.yakable.infrastructure.model;

import io.yakable.plugin.model.api.ModelCapability;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginDescriptor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.ServiceLoader;
import java.util.TreeMap;

/**
 * Discovers model plugins through Java ServiceLoader and provides stable
 * provider routing.
 */
public final class ModelPluginRegistry {

    private final Map<String, ModelPlugin> plugins;

    private ModelPluginRegistry(Map<String, ModelPlugin> plugins) {
        this.plugins = Collections.unmodifiableMap(
                new LinkedHashMap<>(plugins)
        );
    }

    public static ModelPluginRegistry load() {
        ClassLoader classLoader =
                Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ModelPlugin.class.getClassLoader();
        }
        return load(classLoader);
    }

    public static ModelPluginRegistry load(ClassLoader classLoader) {
        Objects.requireNonNull(classLoader, "classLoader");
        return from(ServiceLoader.load(ModelPlugin.class, classLoader));
    }

    public static ModelPluginRegistry from(
            Iterable<ModelPlugin> candidates
    ) {
        Objects.requireNonNull(candidates, "candidates");

        Map<String, ModelPlugin> discovered = new TreeMap<>();
        for (ModelPlugin plugin : candidates) {
            Objects.requireNonNull(
                    plugin,
                    "Model plugin must not be null"
            );
            validateDescriptor(plugin);

            String provider = normalizeProvider(plugin.provider());
            ModelPlugin previous =
                    discovered.putIfAbsent(provider, plugin);
            if (previous != null) {
                throw new IllegalStateException(
                        "Duplicate model plugin for provider "
                                + provider
                                + ": "
                                + previous.getClass().getName()
                                + " and "
                                + plugin.getClass().getName()
                );
            }
        }
        return new ModelPluginRegistry(discovered);
    }

    public Optional<ModelPlugin> find(String provider) {
        String normalized = normalizeNullableProvider(provider);
        return normalized == null
                ? Optional.empty()
                : Optional.ofNullable(plugins.get(normalized));
    }

    public ModelPlugin require(String provider) {
        String normalized = normalizeNullableProvider(provider);
        if (normalized == null) {
            throw new IllegalArgumentException(
                    "Model provider must not be blank"
            );
        }

        ModelPlugin plugin = plugins.get(normalized);
        if (plugin == null) {
            throw new IllegalArgumentException(
                    "Model plugin not found: " + normalized
            );
        }
        return plugin;
    }

    public Map<String, ModelPlugin> plugins() {
        return plugins;
    }

    public List<ModelPluginDescriptor> descriptors() {
        List<ModelPluginDescriptor> result =
                new ArrayList<>(plugins.size());
        for (ModelPlugin plugin : plugins.values()) {
            result.add(plugin.descriptor());
        }
        return List.copyOf(result);
    }

    private static void validateDescriptor(ModelPlugin plugin) {
        ModelPluginDescriptor descriptor = plugin.descriptor();
        if (descriptor == null) {
            throw new IllegalStateException(
                    "Model plugin descriptor must not be null: "
                            + plugin.getClass().getName()
            );
        }
        if (!normalizeProvider(descriptor.provider())
                .equals(normalizeProvider(plugin.provider()))) {
            throw new IllegalStateException(
                    "Model plugin provider mismatch: plugin="
                            + plugin.provider()
                            + ", descriptor="
                            + descriptor.provider()
            );
        }
        if (!ModelPluginDescriptor.CURRENT_API_VERSION.equals(
                descriptor.apiVersion()
        )) {
            throw new IllegalStateException(
                    "Unsupported model plugin API version "
                            + descriptor.apiVersion()
                            + " for "
                            + descriptor.provider()
            );
        }
        if (!descriptor.supports(ModelCapability.CHAT)) {
            throw new IllegalStateException(
                    "Model plugin must support CHAT: "
                            + descriptor.provider()
            );
        }
    }

    private static String normalizeProvider(String provider) {
        String normalized = normalizeNullableProvider(provider);
        if (normalized == null) {
            throw new IllegalArgumentException(
                    "Model provider must not be blank"
            );
        }
        return normalized;
    }

    private static String normalizeNullableProvider(String provider) {
        if (provider == null || provider.trim().isEmpty()) {
            return null;
        }
        return provider.trim().toLowerCase(Locale.ROOT);
    }
}
