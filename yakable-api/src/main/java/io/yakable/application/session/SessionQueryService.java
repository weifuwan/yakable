package io.yakable.application.session;

import io.yakable.domain.session.SessionNotFoundException;

import java.util.Objects;

public final class SessionQueryService {

    private static final int MAX_MESSAGE_PAGE_SIZE = 100;

    private final SessionQueryRepository queryRepository;

    public SessionQueryService(
            SessionQueryRepository queryRepository
    ) {
        this.queryRepository = Objects.requireNonNull(
                queryRepository,
                "queryRepository"
        );
    }

    public SessionSnapshot getSnapshot(
            String projectId,
            String sessionId
    ) {
        String normalizedProjectId =
                requireText(projectId, "projectId");
        String normalizedSessionId =
                requireText(sessionId, "sessionId");

        return queryRepository.findSnapshot(
                        normalizedProjectId,
                        normalizedSessionId
                )
                .orElseThrow(() -> new SessionNotFoundException(
                        normalizedSessionId
                ));
    }

    public SessionChanges getChanges(
            String projectId,
            String sessionId,
            long afterSequence
    ) {
        if (afterSequence < 0) {
            throw new IllegalArgumentException(
                    "afterSequence must not be negative"
            );
        }

        String normalizedProjectId =
                requireText(projectId, "projectId");
        String normalizedSessionId =
                requireText(sessionId, "sessionId");

        return queryRepository.findChanges(
                        normalizedProjectId,
                        normalizedSessionId,
                        afterSequence
                )
                .orElseThrow(() -> new SessionNotFoundException(
                        normalizedSessionId
                ));
    }

    public SessionMessagePage getMessagePage(
            String projectId,
            String sessionId,
            Long beforeSequence,
            int limit
    ) {
        if (beforeSequence != null && beforeSequence <= 0) {
            throw new IllegalArgumentException(
                    "beforeSequence must be positive"
            );
        }
        if (limit <= 0 || limit > MAX_MESSAGE_PAGE_SIZE) {
            throw new IllegalArgumentException(
                    "limit must be between 1 and "
                            + MAX_MESSAGE_PAGE_SIZE
            );
        }

        String normalizedProjectId =
                requireText(projectId, "projectId");
        String normalizedSessionId =
                requireText(sessionId, "sessionId");

        return queryRepository.findMessagePage(
                        normalizedProjectId,
                        normalizedSessionId,
                        beforeSequence,
                        limit
                )
                .orElseThrow(() -> new SessionNotFoundException(
                        normalizedSessionId
                ));
    }

    private static String requireText(
            String value,
            String field
    ) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    field + " must not be blank"
            );
        }
        return normalized;
    }
}
