package io.yakable.plugin.model.deepseek;

import io.yakable.plugin.model.api.ModelPluginException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DeepSeekModelPluginTest {

    private final DeepSeekModelPlugin plugin = new DeepSeekModelPlugin();

    @Test
    void shouldExposeContextMetadataForSupportedModel() {
        var metadata = plugin.modelMetadata("deepseek-flash");

        assertThat(metadata.contextWindowTokens()).isEqualTo(1_000_000L);
        assertThat(metadata.reservedOutputTokens()).isEqualTo(65_536L);
    }

    @Test
    void shouldRejectModelWithoutContextMetadata() {
        assertThatThrownBy(() -> plugin.modelMetadata("unknown-model"))
                .isInstanceOf(ModelPluginException.class)
                .hasMessageContaining("deepseek/unknown-model");
    }
}
