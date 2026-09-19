package io.yakable.dao.session.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.yakable.dao.session.model.SessionPO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface SessionMapper extends BaseMapper<SessionPO> {

    @Select("""
            SELECT id, project_id, title, provider, model, status,
                   created_at, updated_at
            FROM yak_session
            WHERE id = #{sessionId}
            FOR UPDATE
            """)
    SessionPO selectByIdForUpdate(
            @Param("sessionId") String sessionId
    );
}
