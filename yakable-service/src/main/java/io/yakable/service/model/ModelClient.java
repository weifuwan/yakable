package io.yakable.service.model;

import io.yakable.plugin.model.api.LlmMessage;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;
import io.yakable.plugin.model.api.LlmUsage;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginConfiguration;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.ServiceLoader;

public final class ModelClient {

    private final Map<String, ModelPlugin> plugins;
    private final ConfigurationResolver configurationResolver;

    public ModelClient(ConfigurationResolver configurationResolver) {
        this.configurationResolver = Objects.requireNonNull(
                configurationResolver,
                "configurationResolver"
        );
        this.plugins = loadPlugins();
    }

    public Reply chat(
            String provider,
            String model,
            String systemPrompt,
            List<Message> messages
    ) {
        ModelPlugin plugin = requirePlugin(provider);
        ModelPluginConfiguration configuration =
                configurationResolver.resolve(plugin.provider());

        if (configuration == null) {
            configuration = new ModelPluginConfiguration("", "");
        }

        LlmResponse response = plugin.chat(
                configuration,
                new LlmRequest(
                        model,
                        systemPrompt,
                        messages.stream()
                                .map(ModelClient::toLlmMessage)
                                .toList()
                )
        );

        return new Reply(
                response.content(),
                plugin.provider(),
                response.model() == null ? model : response.model(),
                toUsage(response.usage()),
                response.providerRequestId(),
                response.finishReason()
        );
    }

    private ModelPlugin requirePlugin(String provider) {
        String key = normalize(provider);
        ModelPlugin plugin = plugins.get(key);
        if (plugin == null) {
            throw new IllegalArgumentException(
                    "Model plugin not found: " + key
            );
        }
        return plugin;
    }

    private static Map<String, ModelPlugin> loadPlugins() {
        Map<String, ModelPlugin> result = new LinkedHashMap<>();
        for (ModelPlugin plugin : ServiceLoader.load(ModelPlugin.class)) {
            String provider = normalize(plugin.provider());
            if (result.putIfAbsent(provider, plugin) != null) {
                throw new IllegalStateException(
                        "Duplicate model plugin: " + provider
                );
            }
        }
        return Map.copyOf(result);
    }

    private static String normalize(String provider) {
        if (provider == null || provider.isBlank()) {
            throw new IllegalArgumentException(
                    "Model provider must not be blank"
            );
        }
        return provider.trim().toLowerCase(Locale.ROOT);
    }

    private static LlmMessage toLlmMessage(Message message) {
        return new LlmMessage(
                message.role() == Role.USER
                        ? LlmMessage.Role.USER
                        : LlmMessage.Role.ASSISTANT,
                message.content()
        );
    }

    private static Usage toUsage(LlmUsage usage) {
        if (usage == null) {
            return new Usage(null, null, null);
        }
        return new Usage(
                usage.inputTokens(),
                usage.outputTokens(),
                usage.totalTokens()
        );
    }

    @FunctionalInterface
    public interface ConfigurationResolver {
        ModelPluginConfiguration resolve(String provider);
    }

    public enum Role {
        USER,
        ASSISTANT
    }

    public record Message(Role role, String content) {
    }

    public record Usage(
            Long inputTokens,
            Long outputTokens,
            Long totalTokens
    ) {
    }

    public record Reply(
            String content,
            String provider,
            String model,
            Usage usage,
            String providerRequestId,
            String finishReason
    ) {
    }
}
