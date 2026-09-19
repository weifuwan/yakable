package io.yakable.application.session;

import io.yakable.application.async.TurnDispatcher;
import io.yakable.domain.session.repository.SessionExecutionRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

public final class TurnExecutionRecoveryService {

    private final SessionExecutionRepository executionRepository;
    private final TurnDispatcher turnDispatcher;
    private final Duration runningTimeout;
    private final int batchSize;

    public TurnExecutionRecoveryService(
            SessionExecutionRepository executionRepository,
            TurnDispatcher turnDispatcher,
            Duration runningTimeout,
            int batchSize
    ) {
        this.executionRepository = Objects.requireNonNull(
                executionRepository,
                "executionRepository"
        );
        this.turnDispatcher = Objects.requireNonNull(
                turnDispatcher,
                "turnDispatcher"
        );
        this.runningTimeout = requirePositive(
                runningTimeout,
                "runningTimeout"
        );
        if (batchSize <= 0) {
            throw new IllegalArgumentException(
                    "batchSize must be greater than zero"
            );
        }
        this.batchSize = batchSize;
    }

    public TurnRecoveryResult recoverAndDispatch(Instant now) {
        Instant recoveredAt = Objects.requireNonNull(now, "now");
        Instant staleBefore = recoveredAt.minus(runningTimeout);

        int recovered = executionRepository.recoverStaleRunningTurns(
                staleBefore,
                recoveredAt
        );

        List<String> pendingTurnIds =
                executionRepository.findPendingTurnIds(batchSize);

        int accepted = 0;
        for (String turnId : pendingTurnIds) {
            if (dispatchBestEffort(turnId)) {
                accepted++;
            }
        }

        return new TurnRecoveryResult(
                recovered,
                pendingTurnIds.size(),
                accepted
        );
    }

    private boolean dispatchBestEffort(String turnId) {
        try {
            return turnDispatcher.dispatch(turnId);
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private static Duration requirePositive(
            Duration value,
            String field
    ) {
        Objects.requireNonNull(value, field);
        if (value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException(
                    field + " must be positive"
            );
        }
        return value;
    }

    public record TurnRecoveryResult(
            int recoveredRunningTurns,
            int pendingTurns,
            int acceptedDispatches
    ) {
    }
}
