package io.yakable.dao.repository.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.application.session.SessionChanges;
import io.yakable.application.session.SessionMessagePage;
import io.yakable.application.session.SessionQueryRepository;
import io.yakable.application.session.SessionSnapshot;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.mapper.MessageMapper;
import io.yakable.dao.mapper.SessionMapper;
import io.yakable.dao.mapper.TurnMapper;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionStatus;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnStatus;
import io.yakable.domain.session.TurnTokenUsage;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class SessionQueryRepositoryImpl
        implements SessionQueryRepository {

    private final SessionMapper sessionMapper;
    private final TurnMapper turnMapper;
    private final MessageMapper messageMapper;

    public SessionQueryRepositoryImpl(
            SessionMapper sessionMapper,
            TurnMapper turnMapper,
            MessageMapper messageMapper
    ) {
        this.sessionMapper = Objects.requireNonNull(
                sessionMapper,
                "sessionMapper"
        );
        this.turnMapper = Objects.requireNonNull(
                turnMapper,
                "turnMapper"
        );
        this.messageMapper = Objects.requireNonNull(
                messageMapper,
                "messageMapper"
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SessionSnapshot> findSnapshot(
            String projectId,
            String sessionId
    ) {
        Optional<SessionEntity> session = findOwnedSession(
                projectId,
                sessionId
        );
        if (session.isEmpty()) {
            return Optional.empty();
        }

        List<Turn> turns = turnMapper.selectList(
                        Wrappers.<TurnEntity>lambdaQuery()
                                .eq(TurnEntity::getSessionId, sessionId)
                                .orderByAsc(
                                        TurnEntity::getCreatedAt,
                                        TurnEntity::getId
                                )
                )
                .stream()
                .map(SessionQueryRepositoryImpl::toTurnDomain)
                .toList();

        List<SessionMessage> messages =
                messageMapper.selectList(
                                Wrappers.<MessageEntity>lambdaQuery()
                                        .eq(
                                                MessageEntity::getSessionId,
                                                sessionId
                                        )
                                        .orderByAsc(
                                                MessageEntity
                                                        ::getMessageSequence
                                        )
                        )
                        .stream()
                        .map(
                                SessionQueryRepositoryImpl
                                        ::toMessageDomain
                        )
                        .toList();

        return Optional.of(new SessionSnapshot(
                toSessionDomain(session.get()),
                turns,
                messages
        ));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SessionChanges> findChanges(
            String projectId,
            String sessionId,
            long afterSequence
    ) {
        if (findOwnedSession(projectId, sessionId).isEmpty()) {
            return Optional.empty();
        }

        TurnEntity latestTurn = turnMapper.selectOne(
                Wrappers.<TurnEntity>lambdaQuery()
                        .eq(TurnEntity::getSessionId, sessionId)
                        .orderByDesc(
                                TurnEntity::getCreatedAt,
                                TurnEntity::getId
                        )
                        .last("LIMIT 1")
        );
        if (latestTurn == null) {
            return Optional.empty();
        }

        List<SessionMessage> messages =
                messageMapper.selectList(
                                Wrappers.<MessageEntity>lambdaQuery()
                                        .eq(
                                                MessageEntity::getSessionId,
                                                sessionId
                                        )
                                        .gt(
                                                MessageEntity
                                                        ::getMessageSequence,
                                                afterSequence
                                        )
                                        .orderByAsc(
                                                MessageEntity
                                                        ::getMessageSequence
                                        )
                        )
                        .stream()
                        .map(
                                SessionQueryRepositoryImpl
                                        ::toMessageDomain
                        )
                        .toList();

        return Optional.of(new SessionChanges(
                toTurnDomain(latestTurn),
                messages,
                latestMessageSequence(sessionId)
        ));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SessionMessagePage> findMessagePage(
            String projectId,
            String sessionId,
            Long beforeSequence,
            int limit
    ) {
        if (findOwnedSession(projectId, sessionId).isEmpty()) {
            return Optional.empty();
        }

        var query = Wrappers.<MessageEntity>lambdaQuery()
                .eq(MessageEntity::getSessionId, sessionId);

        if (beforeSequence != null) {
            query.lt(
                    MessageEntity::getMessageSequence,
                    beforeSequence
            );
        }

        List<MessageEntity> rows = messageMapper.selectList(
                query.orderByDesc(
                                MessageEntity::getMessageSequence
                        )
                        .last("LIMIT " + (limit + 1))
        );

        boolean hasMore = rows.size() > limit;
        List<MessageEntity> pageRows = hasMore
                ? rows.subList(0, limit)
                : rows;

        List<SessionMessage> messages = new ArrayList<>(
                pageRows.stream()
                        .map(
                                SessionQueryRepositoryImpl
                                        ::toMessageDomain
                        )
                        .toList()
        );
        Collections.reverse(messages);

        Long nextBeforeSequence =
                hasMore && !messages.isEmpty()
                        ? messages.get(0).sequence()
                        : null;

        return Optional.of(new SessionMessagePage(
                messages,
                nextBeforeSequence,
                hasMore
        ));
    }

    private Optional<SessionEntity> findOwnedSession(
            String projectId,
            String sessionId
    ) {
        return Optional.ofNullable(
                sessionMapper.selectOne(
                        Wrappers.<SessionEntity>lambdaQuery()
                                .eq(SessionEntity::getId, sessionId)
                                .eq(
                                        SessionEntity::getProjectId,
                                        projectId
                                )
                )
        );
    }

    private long latestMessageSequence(String sessionId) {
        MessageEntity latest = messageMapper.selectOne(
                Wrappers.<MessageEntity>lambdaQuery()
                        .select(MessageEntity::getMessageSequence)
                        .eq(MessageEntity::getSessionId, sessionId)
                        .orderByDesc(MessageEntity::getMessageSequence)
                        .last("LIMIT 1")
        );
        return latest == null
                || latest.getMessageSequence() == null
                ? 0L
                : latest.getMessageSequence();
    }

    private static Session toSessionDomain(
            SessionEntity entity
    ) {
        return new Session(
                entity.getId(),
                entity.getProjectId(),
                entity.getTitle(),
                entity.getProvider(),
                entity.getModel(),
                SessionStatus.valueOf(entity.getStatus()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static Turn toTurnDomain(TurnEntity entity) {
        return new Turn(
                entity.getId(),
                entity.getSessionId(),
                TurnStatus.valueOf(entity.getStatus()),
                entity.getAttemptCount() == null
                        ? 0
                        : entity.getAttemptCount(),
                entity.getErrorMessage(),
                toInvocation(entity),
                entity.getStartedAt(),
                entity.getFinishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static TurnInvocation toInvocation(
            TurnEntity entity
    ) {
        String provider = entity.getProvider();
        String model = entity.getModel();

        if (provider == null && model == null) {
            return null;
        }
        if (provider == null || model == null) {
            throw new IllegalStateException(
                    "Turn invocation route is incomplete: "
                            + entity.getId()
            );
        }

        TurnTokenUsage usage = null;
        if (entity.getInputTokens() != null
                || entity.getOutputTokens() != null
                || entity.getTotalTokens() != null) {
            usage = new TurnTokenUsage(
                    entity.getInputTokens(),
                    entity.getOutputTokens(),
                    entity.getTotalTokens()
            );
        }

        return new TurnInvocation(
                provider,
                model,
                usage,
                entity.getProviderRequestId(),
                entity.getFinishReason()
        );
    }

    private static SessionMessage toMessageDomain(
            MessageEntity entity
    ) {
        return new SessionMessage(
                entity.getId(),
                entity.getSessionId(),
                entity.getTurnId(),
                SessionMessage.Role.valueOf(entity.getRole()),
                entity.getContent(),
                entity.getMessageSequence(),
                entity.getCreatedAt()
        );
    }
}
