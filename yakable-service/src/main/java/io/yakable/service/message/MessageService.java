package io.yakable.service.message;

import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.repository.MessageRepository;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Message 业务服务。
 */
@Service
public class MessageService {

    @Resource
    private MessageRepository messageRepository;

    /**
     * 新增 Message。
     */
    public MessageVO addMessage(String sessionId, String turnId, MessageRoleEnum role, String content) {
        MessageEntity entity = new MessageEntity();
        entity.initCreate();
        entity.setSessionId(sessionId);
        entity.setTurnId(turnId);
        entity.setRole(role);
        entity.setContent(content);
        entity.setMessageSequence(messageRepository.queryNextMessageSequence(sessionId));
        messageRepository.add(entity);
        return toMessageVO(entity);
    }

    /**
     * 查询 Session 下的 Message。
     */
    public List<MessageVO> queryMessageList(String sessionId) {
        return messageRepository.queryMessageList(sessionId).stream().map(MessageService::toMessageVO).toList();
    }

    /**
     * 查询指定序号之后的 Message。
     */
    public List<MessageVO> queryMessageAfter(String sessionId, long afterSequence) {
        return messageRepository.queryMessageAfter(sessionId, afterSequence).stream().map(MessageService::toMessageVO).toList();
    }

    /**
     * 查询指定序号之前的 Message。
     */
    public List<MessageVO> queryMessageBefore(String sessionId, Long beforeSequence, int limit) {
        return messageRepository.queryMessageBefore(sessionId, beforeSequence, limit)
                .stream().map(MessageService::toMessageVO).toList();
    }

    /**
     * 查询最新 Message 序号。
     */
    public long queryLatestMessageSequence(String sessionId) {
        return messageRepository.queryLatestMessageSequence(sessionId);
    }

    private static MessageVO toMessageVO(MessageEntity entity) {
        MessageVO result = ConverUtils.convert(entity, MessageVO.class);
        result.setRole(entity.getRole().name());
        result.setSequence(entity.getMessageSequence());
        result.setCreatedAt(entity.getCreateTime());
        return result;
    }
}
