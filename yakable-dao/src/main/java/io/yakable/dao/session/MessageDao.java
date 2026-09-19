package io.yakable.dao.session;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.dao.session.mapper.MessageMapper;
import io.yakable.dao.session.model.MessagePO;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Objects;

@Repository
@DependsOn("yakableFlyway")
public class MessageDao {

    private final MessageMapper mapper;

    public MessageDao(MessageMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public int insert(MessagePO message) {
        return mapper.insert(message);
    }

    public List<MessagePO> findBySessionId(String sessionId) {
        return mapper.selectList(
                Wrappers.<MessagePO>lambdaQuery()
                        .eq(MessagePO::getSessionId, sessionId)
                        .orderByAsc(MessagePO::getMessageSequence)
        );
    }

    public List<MessagePO> findAfter(
            String sessionId,
            long afterSequence
    ) {
        return mapper.selectList(
                Wrappers.<MessagePO>lambdaQuery()
                        .eq(MessagePO::getSessionId, sessionId)
                        .gt(
                                MessagePO::getMessageSequence,
                                afterSequence
                        )
                        .orderByAsc(MessagePO::getMessageSequence)
        );
    }

    public List<MessagePO> findBefore(
            String sessionId,
            Long beforeSequence,
            int limit
    ) {
        if (limit <= 0) {
            return List.of();
        }

        var query = Wrappers.<MessagePO>lambdaQuery()
                .eq(MessagePO::getSessionId, sessionId)
                .orderByDesc(MessagePO::getMessageSequence)
                .last("LIMIT " + limit);

        if (beforeSequence != null) {
            query.lt(
                    MessagePO::getMessageSequence,
                    beforeSequence
            );
        }
        return mapper.selectList(query);
    }

    public long latestSequence(String sessionId) {
        MessagePO latest = mapper.selectOne(
                Wrappers.<MessagePO>lambdaQuery()
                        .select(MessagePO::getMessageSequence)
                        .eq(MessagePO::getSessionId, sessionId)
                        .orderByDesc(MessagePO::getMessageSequence)
                        .last("LIMIT 1")
        );
        return latest == null || latest.getMessageSequence() == null
                ? 0L
                : latest.getMessageSequence();
    }

    public long nextSequence(String sessionId) {
        return latestSequence(sessionId) + 1L;
    }
}
