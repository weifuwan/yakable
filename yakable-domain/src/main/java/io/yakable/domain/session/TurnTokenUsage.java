package io.yakable.domain.session;

public record TurnTokenUsage(
        Long inputTokens,
        Long outputTokens,
        Long totalTokens
) {

    public TurnTokenUsage {
        validateTokenCount(inputTokens, "inputTokens");
        validateTokenCount(outputTokens, "outputTokens");
        validateTokenCount(totalTokens, "totalTokens");
    }

    public boolean empty() {
        return inputTokens == null
                && outputTokens == null
                && totalTokens == null;
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
