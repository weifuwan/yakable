package io.yakable.dao.session.mapper;

import io.yakable.dao.session.model.SessionPO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface SessionQueryMapper {

    @Select("""
            SELECT
                id,
                project_id,
                title,
                provider,
                model,
                status,
                created_at,
                updated_at
            FROM yak_session
            WHERE id = #{sessionId}
              AND project_id = #{projectId}
            """)
    SessionPO selectOwnedSession(
            @Param("projectId") String projectId,
            @Param("sessionId") String sessionId
    );
}
