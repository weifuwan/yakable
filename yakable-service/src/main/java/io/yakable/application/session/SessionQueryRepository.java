package io.yakable.application.session;

import java.util.Optional;

public interface SessionQueryRepository {

    Optional<SessionSnapshot> findSnapshot(
            String projectId,
            String sessionId
    );

    Optional<SessionChanges> findChanges(
            String projectId,
            String sessionId,
            long afterSequence
    );

    Optional<SessionMessagePage> findMessagePage(
            String projectId,
            String sessionId,
            Long beforeSequence,
            int limit
    );
}
