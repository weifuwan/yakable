package io.yakable.dao.session;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.dao.session.mapper.TurnMapper;
import io.yakable.dao.session.model.TurnPO;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class TurnDao {

    private final TurnMapper mapper;

    public TurnDao(TurnMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public long countActive(String sessionId) {
        return mapper.selectCount(
                Wrappers.<TurnPO>lambdaQuery()
                        .eq(TurnPO::getSessionId, sessionId)
                        .in(TurnPO::getStatus, "PENDING", "RUNNING")
        );
    }

    public int insert(TurnPO turn) {
        return mapper.insert(turn);
    }

    public Optional<TurnPO> findById(String turnId) {
        return Optional.ofNullable(mapper.selectById(turnId));
    }

    public List<TurnPO> findBySessionId(String sessionId) {
        return mapper.selectList(
                Wrappers.<TurnPO>lambdaQuery()
                        .eq(TurnPO::getSessionId, sessionId)
                        .orderByAsc(TurnPO::getCreatedAt, TurnPO::getId)
        );
    }

    public Optional<TurnPO> findLatest(String sessionId) {
        return Optional.ofNullable(
                mapper.selectOne(
                        Wrappers.<TurnPO>lambdaQuery()
                                .eq(TurnPO::getSessionId, sessionId)
                                .orderByDesc(
                                        TurnPO::getCreatedAt,
                                        TurnPO::getId
                                )
                                .last("LIMIT 1")
                )
        );
    }

    public int claimPending(
            String turnId,
            Instant claimedAt,
            String provider,
            String model
    ) {
        var update = Wrappers.<TurnPO>lambdaUpdate()
                .eq(TurnPO::getId, turnId)
                .eq(TurnPO::getStatus, "PENDING")
                .set(TurnPO::getStatus, "RUNNING")
                .setSql("attempt_count = attempt_count + 1")
                .set(TurnPO::getErrorMessage, null)
                .set(TurnPO::getProvider, provider)
                .set(TurnPO::getModel, model)
                .set(TurnPO::getInputTokens, null)
                .set(TurnPO::getOutputTokens, null)
                .set(TurnPO::getTotalTokens, null)
                .set(TurnPO::getProviderRequestId, null)
                .set(TurnPO::getFinishReason, null)
                .set(TurnPO::getStartedAt, claimedAt)
                .set(TurnPO::getFinishedAt, null)
                .set(TurnPO::getUpdatedAt, claimedAt);
        return mapper.update(null, update);
    }

    public int completeRunning(
            String turnId,
            String sessionId,
            String provider,
            String model,
            Long inputTokens,
            Long outputTokens,
            Long totalTokens,
            String providerRequestId,
            String finishReason,
            Instant completedAt
    ) {
        var update = Wrappers.<TurnPO>lambdaUpdate()
                .eq(TurnPO::getId, turnId)
                .eq(TurnPO::getSessionId, sessionId)
                .eq(TurnPO::getStatus, "RUNNING")
                .set(TurnPO::getStatus, "SUCCEEDED")
                .set(TurnPO::getErrorMessage, null)
                .set(TurnPO::getProvider, provider)
                .set(TurnPO::getModel, model)
                .set(TurnPO::getInputTokens, inputTokens)
                .set(TurnPO::getOutputTokens, outputTokens)
                .set(TurnPO::getTotalTokens, totalTokens)
                .set(TurnPO::getProviderRequestId, providerRequestId)
                .set(TurnPO::getFinishReason, finishReason)
                .set(TurnPO::getFinishedAt, completedAt)
                .set(TurnPO::getUpdatedAt, completedAt);
        return mapper.update(null, update);
    }

    public int failRunning(
            String turnId,
            String sessionId,
            String errorMessage,
            Instant failedAt
    ) {
        var update = Wrappers.<TurnPO>lambdaUpdate()
                .eq(TurnPO::getId, turnId)
                .eq(TurnPO::getSessionId, sessionId)
                .eq(TurnPO::getStatus, "RUNNING")
                .set(TurnPO::getStatus, "FAILED")
                .set(TurnPO::getErrorMessage, errorMessage)
                .set(TurnPO::getFinishedAt, failedAt)
                .set(TurnPO::getUpdatedAt, failedAt);
        return mapper.update(null, update);
    }

    public int recoverStale(
            Instant staleBefore,
            Instant recoveredAt
    ) {
        var update = Wrappers.<TurnPO>lambdaUpdate()
                .eq(TurnPO::getStatus, "RUNNING")
                .isNotNull(TurnPO::getStartedAt)
                .lt(TurnPO::getStartedAt, staleBefore)
                .set(TurnPO::getStatus, "PENDING")
                .set(TurnPO::getErrorMessage, null)
                .set(TurnPO::getProvider, null)
                .set(TurnPO::getModel, null)
                .set(TurnPO::getInputTokens, null)
                .set(TurnPO::getOutputTokens, null)
                .set(TurnPO::getTotalTokens, null)
                .set(TurnPO::getProviderRequestId, null)
                .set(TurnPO::getFinishReason, null)
                .set(TurnPO::getStartedAt, null)
                .set(TurnPO::getFinishedAt, null)
                .set(TurnPO::getUpdatedAt, recoveredAt);
        return mapper.update(null, update);
    }

    public List<String> findPendingIds(int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return mapper.selectList(
                        Wrappers.<TurnPO>lambdaQuery()
                                .select(TurnPO::getId)
                                .eq(TurnPO::getStatus, "PENDING")
                                .orderByAsc(
                                        TurnPO::getCreatedAt,
                                        TurnPO::getId
                                )
                                .last("LIMIT " + limit)
                )
                .stream()
                .map(TurnPO::getId)
                .toList();
    }
}
