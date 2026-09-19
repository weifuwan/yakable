package io.yakable.dao.session.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.yakable.dao.session.model.TurnPO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;

public interface TurnMapper extends BaseMapper<TurnPO> {

    @Update("""
            UPDATE yak_turn
            SET status = 'RUNNING',
                error_message = NULL,
                updated_at = #{claimedAt}
            WHERE id = #{turnId}
              AND status = 'PENDING'
            """)
    int claimPendingTurn(
            @Param("turnId") String turnId,
            @Param("claimedAt") Instant claimedAt
    );

    @Update("""
            UPDATE yak_turn
            SET status = 'SUCCEEDED',
                error_message = NULL,
                updated_at = #{completedAt}
            WHERE id = #{turnId}
              AND session_id = #{sessionId}
              AND status = 'RUNNING'
            """)
    int completeRunningTurn(
            @Param("turnId") String turnId,
            @Param("sessionId") String sessionId,
            @Param("completedAt") Instant completedAt
    );

    @Update("""
            UPDATE yak_turn
            SET status = 'FAILED',
                error_message = #{errorMessage},
                updated_at = #{failedAt}
            WHERE id = #{turnId}
              AND session_id = #{sessionId}
              AND status = 'RUNNING'
            """)
    int failRunningTurn(
            @Param("turnId") String turnId,
            @Param("sessionId") String sessionId,
            @Param("errorMessage") String errorMessage,
            @Param("failedAt") Instant failedAt
    );
}
