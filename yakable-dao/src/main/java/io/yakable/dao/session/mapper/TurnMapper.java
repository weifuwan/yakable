package io.yakable.dao.session.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.yakable.dao.session.model.TurnPO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.List;

public interface TurnMapper extends BaseMapper<TurnPO> {

    @Update("""
            UPDATE yak_turn
            SET status = 'RUNNING',
                attempt_count = attempt_count + 1,
                error_message = NULL,
                started_at = #{claimedAt},
                finished_at = NULL,
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
                finished_at = #{completedAt},
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
                finished_at = #{failedAt},
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

    @Update("""
            UPDATE yak_turn
            SET status = 'PENDING',
                error_message = NULL,
                started_at = NULL,
                finished_at = NULL,
                updated_at = #{recoveredAt}
            WHERE status = 'RUNNING'
              AND started_at IS NOT NULL
              AND started_at < #{staleBefore}
            """)
    int recoverStaleRunningTurns(
            @Param("staleBefore") Instant staleBefore,
            @Param("recoveredAt") Instant recoveredAt
    );

    @Select("""
            SELECT id
            FROM yak_turn
            WHERE status = 'PENDING'
            ORDER BY created_at ASC, id ASC
            LIMIT #{limit}
            """)
    List<String> selectPendingTurnIds(
            @Param("limit") int limit
    );
}
