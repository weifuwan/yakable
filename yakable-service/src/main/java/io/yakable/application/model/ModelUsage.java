package io.yakable.application.model;

public record ModelUsage(
        Long inputTokens,
        Long outputTokens,
        Long totalTokens
) {

    public ModelUsage {
        validateTokenCount(inputTokens, "inputTokens");
        validateTokenCount(outputTokens, "outputTokens");
        validateTokenCount(totalTokens, "totalTokens");
    }

    private static void validateTokenCount(
            Long value,
            String field
    ) {
        if (value != null && value < 0) {
            throw new IllegalArgumentException(
                    field + " must not be negative"
            );
        }
    }
}
