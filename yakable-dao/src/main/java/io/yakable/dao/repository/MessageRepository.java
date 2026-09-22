package io.yakable.dao.repository;

import io.yakable.dao.entity.MessageEntity;

import java.util.List;
import java.util.Optional;

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
     * 查询 Turn 的 USER Message。
     */
    Optional<MessageEntity> queryUserMessage(String turnId);

    /**
     * 查询 Session 指定序号的 Message。
     */
    Optional<MessageEntity> queryMessage(String sessionId, long sequence);

    /**
     * 查询 Session 下的 USER Message 列表。
     */
    List<MessageEntity> queryUserMessageList(String sessionId);

    /**
     * 查询 Session 下的 Message 列表。
     */
    List<MessageEntity> queryMessageList(String sessionId);

    /**
     * 按 Turn ID 批量查询 Message。
     */
    List<MessageEntity> queryMessageListByTurnIds(List<String> turnIds);

    /**
     * 查询指定序号之后的 Message。
     */
    List<MessageEntity> queryMessageAfter(String sessionId, long afterSequence, int limit);

    /**
     * 查询指定序号之前的 Message。
     */
    List<MessageEntity> queryMessageBefore(String sessionId, Long beforeSequence, int limit);
}
