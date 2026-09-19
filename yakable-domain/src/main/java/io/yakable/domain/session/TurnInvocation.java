package io.yakable.domain.session;

import java.util.Objects;

public record TurnInvocation(
        String provider,
        String model,
        TurnTokenUsage usage,
        String providerRequestId,
        String finishReason
) {

    public TurnInvocation {
        provider = requireText(provider, "provider");
        model = requireText(model, "model");
        providerRequestId = normalizeOptionalText(providerRequestId);
        finishReason = normalizeOptionalText(finishReason);
    }

    public static TurnInvocation started(
            String provider,
            String model
    ) {
        return new TurnInvocation(
                provider,
                model,
                null,
                null,
                null
        );
    }

    public TurnInvocation completed(
            String actualProvider,
            String actualModel,
            TurnTokenUsage actualUsage,
            String actualProviderRequestId,
            String actualFinishReason
    ) {
        return new TurnInvocation(
                actualProvider,
                actualModel,
                actualUsage != null && actualUsage.empty()
                        ? null
                        : actualUsage,
                actualProviderRequestId,
                actualFinishReason
        );
    }

    private static String requireText(
            String value,
            String field
    ) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    field + " must not be blank"
            );
        }
        return normalized;
    }

    private static String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.strip();
        return normalized.isEmpty() ? null : normalized;
    }
}
