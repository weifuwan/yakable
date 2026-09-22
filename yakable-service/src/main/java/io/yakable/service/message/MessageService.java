package io.yakable.service.message;

import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.enums.session.MessageRoleEnum;

import java.util.List;
import java.util.Optional;

/**
 * Message 业务服务。
 */
public interface MessageService {

    /**
     * 新增 Message。
     */
    MessageVO addMessage(String sessionId, String turnId, MessageRoleEnum role, String content);

    /**
     * 查询 Turn 的 USER Message。
     */
    Optional<MessageVO> queryUserMessage(String turnId);

    /**
     * 查询 Session 下的 Message。
     */
    List<MessageVO> queryMessageList(String sessionId);

    /**
     * 按 Turn ID 批量查询 Message。
     */
    List<MessageVO> queryMessageListByTurnIds(List<String> turnIds);

    /**
     * 查询指定序号之后的 Message。
     */
    List<MessageVO> queryMessageAfter(String sessionId, long afterSequence, int limit);

    /**
     * 查询指定序号之前的 Message。
     */
    List<MessageVO> queryMessageBefore(String sessionId, Long beforeSequence, int limit);

    /**
     * 查询最新 Message 序号。
     */
    long queryLatestMessageSequence(String sessionId);
}
