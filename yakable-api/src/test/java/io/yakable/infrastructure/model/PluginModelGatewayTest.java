package io.yakable.infrastructure.model;

import io.yakable.application.model.ModelMessage;
import io.yakable.application.model.ModelReply;
import io.yakable.application.model.ModelRequest;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;
import io.yakable.plugin.model.api.LlmUsage;
import io.yakable.plugin.model.api.ModelCapability;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginConfiguration;
import io.yakable.plugin.model.api.ModelPluginDescriptor;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PluginModelGatewayTest {

    @Test
    void mapsActualProviderResponseMetadata() {
        ModelPlugin plugin = new ModelPlugin() {
            @Override
            public ModelPluginDescriptor descriptor() {
                return new ModelPluginDescriptor(
                        "deepseek",
                        "DeepSeek",
                        ModelPluginDescriptor.CURRENT_API_VERSION,
                        Set.of(ModelCapability.CHAT)
                );
            }

            @Override
            public LlmResponse chat(
                    ModelPluginConfiguration configuration,
                    LlmRequest request
            ) {
                return new LlmResponse(
                        "assistant",
                        new LlmUsage(10L, 5L, 15L),
                        "deepseek-flash-actual",
                        "req-123",
                        "stop"
                );
            }
        };

        PluginModelGateway gateway = new PluginModelGateway(
                ModelPluginRegistry.from(List.of(plugin)),
                provider -> new ModelPluginConfiguration(
                        "test-key",
                        "https://example.test"
                )
        );

        ModelReply reply = gateway.chat(
                "deepseek",
                new ModelRequest(
                        "deepseek-flash-requested",
                        "system",
                        List.of(
                                new ModelMessage(
                                        ModelMessage.Role.USER,
                                        "hello"
                                )
                        )
                )
        );

        assertThat(reply.provider()).isEqualTo("deepseek");
        assertThat(reply.model()).isEqualTo("deepseek-flash-actual");
        assertThat(reply.usage().inputTokens()).isEqualTo(10L);
        assertThat(reply.usage().outputTokens()).isEqualTo(5L);
        assertThat(reply.usage().totalTokens()).isEqualTo(15L);
        assertThat(reply.providerRequestId()).isEqualTo("req-123");
        assertThat(reply.finishReason()).isEqualTo("stop");
    }
}
