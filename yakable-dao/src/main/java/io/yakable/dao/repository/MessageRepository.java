package io.yakable.dao.repository;

import io.yakable.dao.entity.MessageEntity;

import java.util.List;

/**
 * Message 数据访问入口。
 */
public interface MessageRepository extends BaseRepository<MessageEntity> {

    /**
     * 查询下一条 Message 序号。
     */
    long queryNextMessageSequence(String sessionId);

    /**
     * 查询最新 Message 序号。
     */
    long queryLatestMessageSequence(String sessionId);

    /**
     * 查询 Session 下的 Message 列表。
     */
    List<MessageEntity> queryMessageList(String sessionId);

    /**
     * 查询指定序号之后的 Message。
     */
    List<MessageEntity> queryMessageAfter(String sessionId, long afterSequence);

    /**
     * 查询指定序号之前的 Message。
     */
    List<MessageEntity> queryMessageBefore(String sessionId, Long beforeSequence, int limit);
}
