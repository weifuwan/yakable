package io.yakable.service.message.impl;

import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.constant.MessageConstant;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.exception.SessionException;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.repository.MessageRepository;
import io.yakable.service.message.MessageService;
import io.yakable.service.observability.ConversationMetrics;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MessageServiceImpl implements MessageService {

    @Resource
    private MessageRepository messageRepository;

    @Resource
    private ConversationMetrics conversationMetrics;

    @Override
    public MessageVO addMessage(String sessionId, String turnId, MessageRoleEnum role, String content) {
        if (content != null && content.length() > MessageConstant.MAX_CONTENT_LENGTH) {
            conversationMetrics.messageTooLarge();
            throw new SessionException(SessionErrorCode.MESSAGE_TOO_LARGE);
        }

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

    @Override
    public Optional<MessageVO> queryUserMessage(String turnId) {
        return messageRepository.queryUserMessage(turnId).map(MessageServiceImpl::toMessageVO);
    }

    @Override
    public Optional<MessageVO> queryMessage(String sessionId, long sequence) {
        return messageRepository.queryMessage(sessionId, sequence).map(MessageServiceImpl::toMessageVO);
    }

    @Override
    public List<MessageVO> queryUserMessageList(String sessionId) {
        return messageRepository.queryUserMessageList(sessionId).stream()
                .map(MessageServiceImpl::toMessageVO).toList();
    }

    @Override
    public List<MessageVO> queryMessageList(String sessionId) {
        return messageRepository.queryMessageList(sessionId).stream().map(MessageServiceImpl::toMessageVO).toList();
    }

    @Override
    public List<MessageVO> queryMessageListByTurnIds(List<String> turnIds) {
        return messageRepository.queryMessageListByTurnIds(turnIds).stream()
                .map(MessageServiceImpl::toMessageVO).toList();
    }

    @Override
    public List<MessageVO> queryMessageAfter(String sessionId, long afterSequence, int limit) {
        return messageRepository.queryMessageAfter(sessionId, afterSequence, limit).stream()
                .map(MessageServiceImpl::toMessageVO).toList();
    }

    @Override
    public List<MessageVO> queryMessageBefore(String sessionId, Long beforeSequence, int limit) {
        return messageRepository.queryMessageBefore(sessionId, beforeSequence, limit)
                .stream().map(MessageServiceImpl::toMessageVO).toList();
    }

    @Override
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
