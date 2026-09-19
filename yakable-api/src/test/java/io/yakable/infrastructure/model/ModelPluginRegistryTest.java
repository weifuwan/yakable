package io.yakable.infrastructure.model;

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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ModelPluginRegistryTest {

    @Test
    void routesPluginsByNormalizedProvider() {
        ModelPlugin plugin = new TestPlugin("deepseek");

        ModelPluginRegistry registry =
                ModelPluginRegistry.from(List.of(plugin));

        assertThat(registry.require(" DeepSeek ")).isSameAs(plugin);
        assertThat(registry.descriptors())
                .extracting(ModelPluginDescriptor::provider)
                .containsExactly("deepseek");
    }

    @Test
    void rejectsDuplicateProviders() {
        assertThatThrownBy(() -> ModelPluginRegistry.from(List.of(
                new TestPlugin("deepseek"),
                new TestPlugin("DEEPSEEK")
        )))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate model plugin");
    }

    private static final class TestPlugin implements ModelPlugin {

        private final ModelPluginDescriptor descriptor;

        private TestPlugin(String provider) {
            descriptor = new ModelPluginDescriptor(
                    provider,
                    provider,
                    ModelPluginDescriptor.CURRENT_API_VERSION,
                    Set.of(ModelCapability.CHAT)
            );
        }

        @Override
        public ModelPluginDescriptor descriptor() {
            return descriptor;
        }

        @Override
        public LlmResponse chat(
                ModelPluginConfiguration configuration,
                LlmRequest request
        ) {
            return new LlmResponse(
                    "ok",
                    new LlmUsage(null, null, null)
            );
        }
    }
}
