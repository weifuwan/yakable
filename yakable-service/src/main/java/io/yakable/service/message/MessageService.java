package io.yakable.service.message;

import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.enums.session.MessageRoleEnum;

import java.util.List;

/**
 * Message 业务服务。
 */
public interface MessageService {

    /**
     * 新增 Message。
     */
    MessageVO addMessage(String sessionId, String turnId, MessageRoleEnum role, String content);

    /**
     * 查询 Session 下的 Message。
     */
    List<MessageVO> queryMessageList(String sessionId);

    /**
     * 查询指定序号之后的 Message。
     */
    List<MessageVO> queryMessageAfter(String sessionId, long afterSequence);

    /**
     * 查询指定序号之前的 Message。
     */
    List<MessageVO> queryMessageBefore(String sessionId, Long beforeSequence, int limit);

    /**
     * 查询最新 Message 序号。
     */
    long queryLatestMessageSequence(String sessionId);
}
