package io.yakable.dao.session;

import io.yakable.application.session.SessionChanges;
import io.yakable.application.session.SessionMessagePage;
import io.yakable.application.session.SessionQueryRepository;
import io.yakable.application.session.SessionSnapshot;
import io.yakable.dao.session.model.MessagePO;
import io.yakable.dao.session.model.SessionPO;
import io.yakable.dao.session.model.TurnPO;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionStatus;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnStatus;
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

    private final SessionQueryDao dao;

    public SessionQueryRepositoryAdapter(SessionQueryDao dao) {
        this.dao = Objects.requireNonNull(dao, "dao");
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SessionSnapshot> findSnapshot(
            String projectId,
            String sessionId
    ) {
        Optional<SessionPO> session = dao.findOwnedSession(
                projectId,
                sessionId
        );
        if (session.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(new SessionSnapshot(
                toDomain(session.get()),
                dao.findTurns(sessionId).stream()
                        .map(SessionQueryRepositoryAdapter::toDomain)
                        .toList(),
                dao.findMessages(sessionId).stream()
                        .map(SessionQueryRepositoryAdapter::toDomain)
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
        if (dao.findOwnedSession(projectId, sessionId).isEmpty()) {
            return Optional.empty();
        }

        Optional<TurnPO> latestTurn = dao.findLatestTurn(sessionId);
        if (latestTurn.isEmpty()) {
            return Optional.empty();
        }

        List<SessionMessage> messages =
                dao.findMessagesAfter(sessionId, afterSequence)
                        .stream()
                        .map(SessionQueryRepositoryAdapter::toDomain)
                        .toList();

        return Optional.of(new SessionChanges(
                toDomain(latestTurn.get()),
                messages,
                dao.latestMessageSequence(sessionId)
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
        if (dao.findOwnedSession(projectId, sessionId).isEmpty()) {
            return Optional.empty();
        }

        List<MessagePO> rows = dao.findMessagesBefore(
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
                        .map(SessionQueryRepositoryAdapter::toDomain)
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

    private static Turn toDomain(TurnPO po) {
        return new Turn(
                po.getId(),
                po.getSessionId(),
                TurnStatus.valueOf(po.getStatus()),
                po.getAttemptCount() == null
                        ? 0
                        : po.getAttemptCount(),
                po.getErrorMessage(),
                po.getStartedAt(),
                po.getFinishedAt(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }

    private static SessionMessage toDomain(MessagePO po) {
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
