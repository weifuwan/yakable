package io.yakable.dao.session;

import io.yakable.dao.session.model.TurnPO;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnStatus;
import io.yakable.domain.session.TurnTokenUsage;

final class TurnPersistenceConverter {

    private TurnPersistenceConverter() {
    }

    static TurnPO toPO(Turn turn) {
        TurnPO po = new TurnPO();
        po.setId(turn.id());
        po.setSessionId(turn.sessionId());
        po.setStatus(turn.status().name());
        po.setAttemptCount(turn.attemptCount());
        po.setErrorMessage(turn.errorMessage());

        TurnInvocation invocation = turn.invocation();
        if (invocation != null) {
            po.setProvider(invocation.provider());
            po.setModel(invocation.model());

            TurnTokenUsage usage = invocation.usage();
            if (usage != null) {
                po.setInputTokens(usage.inputTokens());
                po.setOutputTokens(usage.outputTokens());
                po.setTotalTokens(usage.totalTokens());
            }

            po.setProviderRequestId(
                    invocation.providerRequestId()
            );
            po.setFinishReason(invocation.finishReason());
        }

        po.setStartedAt(turn.startedAt());
        po.setFinishedAt(turn.finishedAt());
        po.setCreatedAt(turn.createdAt());
        po.setUpdatedAt(turn.updatedAt());
        return po;
    }

    static Turn toDomain(TurnPO po) {
        return new Turn(
                po.getId(),
                po.getSessionId(),
                TurnStatus.valueOf(po.getStatus()),
                po.getAttemptCount() == null
                        ? 0
                        : po.getAttemptCount(),
                po.getErrorMessage(),
                toInvocation(po),
                po.getStartedAt(),
                po.getFinishedAt(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }

    private static TurnInvocation toInvocation(TurnPO po) {
        String provider = po.getProvider();
        String model = po.getModel();

        if (provider == null && model == null) {
            return null;
        }
        if (provider == null || model == null) {
            throw new IllegalStateException(
                    "Turn invocation route is incomplete: "
                            + po.getId()
            );
        }

        TurnTokenUsage usage = null;
        if (po.getInputTokens() != null
                || po.getOutputTokens() != null
                || po.getTotalTokens() != null) {
            usage = new TurnTokenUsage(
                    po.getInputTokens(),
                    po.getOutputTokens(),
                    po.getTotalTokens()
            );
        }

        return new TurnInvocation(
                provider,
                model,
                usage,
                po.getProviderRequestId(),
                po.getFinishReason()
        );
    }
}
