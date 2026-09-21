package io.yakable.core.llm;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LlmModelMetadataTest {

    @Test
    void shouldCalculateInputBudget() {
        LlmModelMetadata metadata = new LlmModelMetadata(1_000L, 200L);

        assertThat(metadata.inputBudgetTokens()).isEqualTo(800L);
    }

    @Test
    void shouldRejectNonPositiveContextWindow() {
        assertThatThrownBy(() -> new LlmModelMetadata(0L, 0L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("contextWindowTokens");
    }

    @Test
    void shouldRejectNegativeReservedOutput() {
        assertThatThrownBy(() -> new LlmModelMetadata(1_000L, -1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("reservedOutputTokens");
    }

    @Test
    void shouldRejectReservedOutputThatConsumesWholeContext() {
        assertThatThrownBy(() -> new LlmModelMetadata(1_000L, 1_000L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("reservedOutputTokens");
    }
}
