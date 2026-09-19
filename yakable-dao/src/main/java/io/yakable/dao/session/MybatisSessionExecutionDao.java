package io.yakable.dao.session;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.dao.session.mapper.MessageMapper;
import io.yakable.dao.session.mapper.TurnMapper;
import io.yakable.dao.session.model.MessagePO;
import io.yakable.dao.session.model.TurnPO;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class MybatisSessionExecutionDao
        implements SessionExecutionDao {

    private final TurnMapper turnMapper;
    private final MessageMapper messageMapper;

    public MybatisSessionExecutionDao(
            TurnMapper turnMapper,
            MessageMapper messageMapper
    ) {
        this.turnMapper = Objects.requireNonNull(
                turnMapper,
                "turnMapper"
        );
        this.messageMapper = Objects.requireNonNull(
                messageMapper,
                "messageMapper"
        );
    }

    @Override
    public long countActiveTurns(String sessionId) {
        return turnMapper.selectCount(
                Wrappers.<TurnPO>lambdaQuery()
                        .eq(TurnPO::getSessionId, sessionId)
                        .in(
                                TurnPO::getStatus,
                                "PENDING",
                                "RUNNING"
                        )
        );
    }

    @Override
    public int insertTurn(TurnPO turn) {
        return turnMapper.insert(turn);
    }

    @Override
    public Optional<TurnPO> findTurnById(String turnId) {
        return Optional.ofNullable(turnMapper.selectById(turnId));
    }

    @Override
    public List<TurnPO> findTurnsBySessionId(String sessionId) {
        return turnMapper.selectList(
                Wrappers.<TurnPO>lambdaQuery()
                        .eq(TurnPO::getSessionId, sessionId)
        );
    }

    @Override
    public int claimPendingTurn(
            String turnId,
            Instant claimedAt,
            String provider,
            String model
    ) {
        return turnMapper.claimPendingTurn(
                turnId,
                claimedAt,
                provider,
                model
        );
    }

    @Override
    public int completeRunningTurn(
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
        return turnMapper.completeRunningTurn(
                turnId,
                sessionId,
                provider,
                model,
                inputTokens,
                outputTokens,
                totalTokens,
                providerRequestId,
                finishReason,
                completedAt
        );
    }

    @Override
    public int failRunningTurn(
            String turnId,
            String sessionId,
            String errorMessage,
            Instant failedAt
    ) {
        return turnMapper.failRunningTurn(
                turnId,
                sessionId,
                errorMessage,
                failedAt
        );
    }

    @Override
    public int recoverStaleRunningTurns(
            Instant staleBefore,
            Instant recoveredAt
    ) {
        return turnMapper.recoverStaleRunningTurns(
                staleBefore,
                recoveredAt
        );
    }

    @Override
    public List<String> findPendingTurnIds(int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return turnMapper.selectPendingTurnIds(limit);
    }

    @Override
    public long nextMessageSequence(String sessionId) {
        return messageMapper.selectMaxSequence(sessionId) + 1L;
    }

    @Override
    public int insertMessage(MessagePO message) {
        return messageMapper.insert(message);
    }

    @Override
    public List<MessagePO> findMessagesBySessionId(
            String sessionId
    ) {
        return messageMapper.selectList(
                Wrappers.<MessagePO>lambdaQuery()
                        .eq(MessagePO::getSessionId, sessionId)
        );
    }
}
