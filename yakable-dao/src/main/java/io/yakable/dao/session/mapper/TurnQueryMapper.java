package io.yakable.dao.session.mapper;

import io.yakable.dao.session.model.TurnPO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface TurnQueryMapper {

    @Select("""
            SELECT
                id,
                session_id,
                status,
                attempt_count,
                error_message,
                provider,
                model,
                input_tokens,
                output_tokens,
                total_tokens,
                provider_request_id,
                finish_reason,
                started_at,
                finished_at,
                created_at,
                updated_at
            FROM yak_turn
            WHERE session_id = #{sessionId}
            ORDER BY created_at ASC, id ASC
            """)
    List<TurnPO> selectSessionTurns(
            @Param("sessionId") String sessionId
    );

    @Select("""
            SELECT
                id,
                session_id,
                status,
                attempt_count,
                error_message,
                provider,
                model,
                input_tokens,
                output_tokens,
                total_tokens,
                provider_request_id,
                finish_reason,
                started_at,
                finished_at,
                created_at,
                updated_at
            FROM yak_turn
            WHERE session_id = #{sessionId}
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """)
    TurnPO selectLatestTurn(
            @Param("sessionId") String sessionId
    );
}
