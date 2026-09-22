package io.yakable.dao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.yakable.dao.entity.MessageEntity;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface MessageMapper extends BaseMapper<MessageEntity> {

    List<MessageEntity> selectUserNavigationMessageList(@Param("sessionId") String sessionId);
}
