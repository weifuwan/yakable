package io.yakable.dao.session;

import io.yakable.application.session.SessionChanges;
import io.yakable.application.session.SessionMessagePage;
import io.yakable.application.session.SessionQueryRepository;
import io.yakable.application.session.SessionSnapshot;
import io.yakable.dao.session.model.MessagePO;
import io.yakable.dao.session.model.SessionPO;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionStatus;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
public class SessionQueryRepositoryAdapter
        implements SessionQueryRepository {

    private final SessionDao sessionDao;
    private final TurnDao turnDao;
    private final MessageDao messageDao;

    public SessionQueryRepositoryAdapter(
            SessionDao sessionDao,
            TurnDao turnDao,
            MessageDao messageDao
    ) {
        this.sessionDao = Objects.requireNonNull(
                sessionDao,
                "sessionDao"
        );
        this.turnDao = Objects.requireNonNull(turnDao, "turnDao");
        this.messageDao = Objects.requireNonNull(
                messageDao,
                "messageDao"
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SessionSnapshot> findSnapshot(
            String projectId,
            String sessionId
    ) {
        Optional<SessionPO> session = sessionDao.findOwned(
                projectId,
                sessionId
        );
        if (session.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(new SessionSnapshot(
                toDomain(session.get()),
                turnDao.findBySessionId(sessionId).stream()
                        .map(TurnPersistenceConverter::toDomain)
                        .toList(),
                messageDao.findBySessionId(sessionId).stream()
                        .map(SessionQueryRepositoryAdapter::toMessageDomain)
                        .toList()
        ));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SessionChanges> findChanges(
            String projectId,
            String sessionId,
            long afterSequence
    ) {
        if (sessionDao.findOwned(projectId, sessionId).isEmpty()) {
            return Optional.empty();
        }

        var latestTurn = turnDao.findLatest(sessionId);
        if (latestTurn.isEmpty()) {
            return Optional.empty();
        }

        List<SessionMessage> messages =
                messageDao.findAfter(sessionId, afterSequence)
                        .stream()
                        .map(SessionQueryRepositoryAdapter::toMessageDomain)
                        .toList();

        return Optional.of(new SessionChanges(
                TurnPersistenceConverter.toDomain(latestTurn.get()),
                messages,
                messageDao.latestSequence(sessionId)
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
        if (sessionDao.findOwned(projectId, sessionId).isEmpty()) {
            return Optional.empty();
        }

        List<MessagePO> rows = messageDao.findBefore(
                sessionId,
                beforeSequence,
                limit + 1
        );

        boolean hasMore = rows.size() > limit;
        List<MessagePO> pageRows = hasMore
                ? rows.subList(0, limit)
                : rows;

        List<SessionMessage> messages = new ArrayList<>(
                pageRows.stream()
                        .map(SessionQueryRepositoryAdapter::toMessageDomain)
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

    private static Session toDomain(SessionPO po) {
        return new Session(
                po.getId(),
                po.getProjectId(),
                po.getTitle(),
                po.getProvider(),
                po.getModel(),
                SessionStatus.valueOf(po.getStatus()),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }

    private static SessionMessage toMessageDomain(MessagePO po) {
        return new SessionMessage(
                po.getId(),
                po.getSessionId(),
                po.getTurnId(),
                SessionMessage.Role.valueOf(po.getRole()),
                po.getContent(),
                po.getMessageSequence(),
                po.getCreatedAt()
        );
    }
}
