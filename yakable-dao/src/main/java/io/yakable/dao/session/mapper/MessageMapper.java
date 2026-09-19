package io.yakable.dao.session.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.yakable.dao.session.model.MessagePO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface MessageMapper extends BaseMapper<MessagePO> {

    @Select("""
            SELECT COALESCE(MAX(message_sequence), 0)
            FROM yak_message
            WHERE session_id = #{sessionId}
            """)
    long selectMaxSequence(
            @Param("sessionId") String sessionId
    );
}
