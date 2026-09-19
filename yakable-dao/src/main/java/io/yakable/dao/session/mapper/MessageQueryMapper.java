package io.yakable.dao.session.mapper;

import io.yakable.dao.session.model.MessagePO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface MessageQueryMapper {

    @Select("""
            SELECT
                id,
                session_id,
                turn_id,
                role,
                content,
                message_sequence,
                created_at
            FROM yak_message
            WHERE session_id = #{sessionId}
            ORDER BY message_sequence ASC
            """)
    List<MessagePO> selectSessionMessages(
            @Param("sessionId") String sessionId
    );

    @Select("""
            SELECT
                id,
                session_id,
                turn_id,
                role,
                content,
                message_sequence,
                created_at
            FROM yak_message
            WHERE session_id = #{sessionId}
              AND message_sequence > #{afterSequence}
            ORDER BY message_sequence ASC
            """)
    List<MessagePO> selectMessagesAfter(
            @Param("sessionId") String sessionId,
            @Param("afterSequence") long afterSequence
    );

    @Select("""
            SELECT
                id,
                session_id,
                turn_id,
                role,
                content,
                message_sequence,
                created_at
            FROM yak_message
            WHERE session_id = #{sessionId}
              AND (
                  #{beforeSequence} IS NULL
                  OR message_sequence < #{beforeSequence}
              )
            ORDER BY message_sequence DESC
            LIMIT #{limit}
            """)
    List<MessagePO> selectMessagesBefore(
            @Param("sessionId") String sessionId,
            @Param("beforeSequence") Long beforeSequence,
            @Param("limit") int limit
    );

    @Select("""
            SELECT COALESCE(MAX(message_sequence), 0)
            FROM yak_message
            WHERE session_id = #{sessionId}
            """)
    long selectLatestSequence(
            @Param("sessionId") String sessionId
    );
}
