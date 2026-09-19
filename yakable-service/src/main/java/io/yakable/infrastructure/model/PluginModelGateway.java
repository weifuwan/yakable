package io.yakable.infrastructure.model;

import io.yakable.application.model.ModelGateway;
import io.yakable.application.model.ModelMessage;
import io.yakable.application.model.ModelReply;
import io.yakable.application.model.ModelRequest;
import io.yakable.application.model.ModelUsage;
import io.yakable.plugin.model.api.LlmMessage;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;
import io.yakable.plugin.model.api.LlmUsage;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginConfiguration;

import java.util.List;
import java.util.Objects;

public final class PluginModelGateway implements ModelGateway {

    private final ModelPluginRegistry registry;
    private final ModelPluginConfigurationResolver configurationResolver;

    public PluginModelGateway(
            ModelPluginRegistry registry,
            ModelPluginConfigurationResolver configurationResolver
    ) {
        this.registry = Objects.requireNonNull(
                registry,
                "registry"
        );
        this.configurationResolver = Objects.requireNonNull(
                configurationResolver,
                "configurationResolver"
        );
    }

    @Override
    public ModelReply chat(
            String provider,
            ModelRequest request
    ) {
        Objects.requireNonNull(request, "request");

        ModelPlugin plugin = registry.require(provider);
        ModelPluginConfiguration configuration =
                configurationResolver.resolve(plugin.provider());

        if (configuration == null) {
            configuration = new ModelPluginConfiguration("", "");
        }

        List<LlmMessage> messages = request.messages().stream()
                .map(PluginModelGateway::toLlmMessage)
                .toList();

        LlmResponse response = plugin.chat(
                configuration,
                new LlmRequest(
                        request.model(),
                        request.systemPrompt(),
                        messages
                )
        );

        return new ModelReply(
                response.content(),
                plugin.provider(),
                response.model() == null
                        ? request.model()
                        : response.model(),
                toModelUsage(response.usage()),
                response.providerRequestId(),
                response.finishReason()
        );
    }

    private static ModelUsage toModelUsage(LlmUsage usage) {
        return new ModelUsage(
                usage.inputTokens(),
                usage.outputTokens(),
                usage.totalTokens()
        );
    }

    private static LlmMessage toLlmMessage(
            ModelMessage message
    ) {
        LlmMessage.Role role = switch (message.role()) {
            case USER -> LlmMessage.Role.USER;
            case ASSISTANT -> LlmMessage.Role.ASSISTANT;
        };
        return new LlmMessage(role, message.content());
    }
}
