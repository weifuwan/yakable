package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.mapper.MessageMapper;
import io.yakable.dao.repository.MessageRepository;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@DependsOn("yakableFlyway")
public class MessageRepositoryImpl extends BaseRepositoryImpl<MessageMapper, MessageEntity> implements MessageRepository {

    @Resource
    private MessageMapper messageMapper;

    @Override
    protected MessageMapper mapper() {
        return messageMapper;
    }

    @Override
    public long queryNextMessageSequence(String sessionId) {
        Page<MessageEntity> page = new Page<>(1, 1, false);
        MessageEntity latest = messageMapper.selectPage(
                        page,
                        Wrappers.<MessageEntity>lambdaQuery()
                                .select(MessageEntity::getMessageSequence)
                                .eq(MessageEntity::getSessionId, sessionId)
                                .orderByDesc(MessageEntity::getMessageSequence))
                .getRecords()
                .stream()
                .findFirst()
                .orElse(null);
        return latest == null || latest.getMessageSequence() == null ? 1L : latest.getMessageSequence() + 1L;
    }

    @Override
    public long queryLatestMessageSequence(String sessionId) {
        return Math.max(0L, queryNextMessageSequence(sessionId) - 1L);
    }

    @Override
    public List<MessageEntity> queryMessageList(String sessionId) {
        return messageMapper.selectList(
                Wrappers.<MessageEntity>lambdaQuery()
                        .eq(MessageEntity::getSessionId, sessionId)
                        .orderByAsc(MessageEntity::getMessageSequence));
    }

    @Override
    public List<MessageEntity> queryMessageAfter(String sessionId, long afterSequence) {
        return messageMapper.selectList(
                Wrappers.<MessageEntity>lambdaQuery()
                        .eq(MessageEntity::getSessionId, sessionId)
                        .gt(MessageEntity::getMessageSequence, afterSequence)
                        .orderByAsc(MessageEntity::getMessageSequence));
    }

    @Override
    public List<MessageEntity> queryMessageBefore(String sessionId, Long beforeSequence, int limit) {
        var query = Wrappers.<MessageEntity>lambdaQuery().eq(MessageEntity::getSessionId, sessionId);
        if (beforeSequence != null) {
            query.lt(MessageEntity::getMessageSequence, beforeSequence);
        }
        query.orderByDesc(MessageEntity::getMessageSequence);

        Page<MessageEntity> page = new Page<>(1, limit, false);
        return messageMapper.selectPage(page, query).getRecords();
    }
}
