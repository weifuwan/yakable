package io.yakable.boot.controller.session;

import io.yakable.application.session.SessionChanges;
import io.yakable.application.session.SessionMessagePage;
import io.yakable.application.session.SessionSnapshot;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnTokenUsage;
import io.yakable.domain.session.TurnStartResult;
import io.yakable.service.session.SessionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/sessions")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/{sessionId}")
    public SessionSnapshotResponse getSession(
            @PathVariable String projectId,
            @PathVariable String sessionId
    ) {
        return SessionSnapshotResponse.from(
                sessionService.getSnapshot(projectId, sessionId)
        );
    }

    @GetMapping("/{sessionId}/changes")
    public SessionChangesResponse getChanges(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "0") long afterSequence
    ) {
        return SessionChangesResponse.from(
                sessionService.getChanges(
                        projectId,
                        sessionId,
                        afterSequence
                )
        );
    }

    @GetMapping("/{sessionId}/messages")
    public MessagePageResponse getMessages(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(required = false) Long beforeSequence,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return MessagePageResponse.from(
                sessionService.getMessagePage(
                        projectId,
                        sessionId,
                        beforeSequence,
                        limit
                )
        );
    }

    @PostMapping("/{sessionId}/turns")
    public ResponseEntity<TurnStartResponse> startTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @Valid @RequestBody StartTurnRequest request
    ) {
        TurnStartResult result = sessionService.startTurn(
                projectId,
                sessionId,
                request.content()
        );

        return ResponseEntity
                .accepted()
                .body(TurnStartResponse.from(result));
    }

    public record StartTurnRequest(
            @NotBlank String content
    ) {
    }

    public record SessionSnapshotResponse(
            SessionResponse session,
            List<TurnResponse> turns,
            List<MessageResponse> messages
    ) {

        static SessionSnapshotResponse from(
                SessionSnapshot snapshot
        ) {
            return new SessionSnapshotResponse(
                    SessionResponse.from(snapshot.session()),
                    snapshot.turns().stream()
                            .map(TurnResponse::from)
                            .toList(),
                    snapshot.messages().stream()
                            .map(MessageResponse::from)
                            .toList()
            );
        }
    }

    public record SessionChangesResponse(
            TurnResponse latestTurn,
            List<MessageResponse> messages,
            long latestSequence
    ) {

        static SessionChangesResponse from(
                SessionChanges changes
        ) {
            return new SessionChangesResponse(
                    TurnResponse.from(changes.latestTurn()),
                    changes.messages().stream()
                            .map(MessageResponse::from)
                            .toList(),
                    changes.latestSequence()
            );
        }
    }

    public record MessagePageResponse(
            List<MessageResponse> messages,
            Long nextBeforeSequence,
            boolean hasMore
    ) {

        static MessagePageResponse from(
                SessionMessagePage page
        ) {
            return new MessagePageResponse(
                    page.messages().stream()
                            .map(MessageResponse::from)
                            .toList(),
                    page.nextBeforeSequence(),
                    page.hasMore()
            );
        }
    }

    public record SessionResponse(
            String id,
            String projectId,
            String title,
            ModelResponse model,
            String status,
            Instant createdAt,
            Instant updatedAt
    ) {

        static SessionResponse from(Session session) {
            return new SessionResponse(
                    session.id(),
                    session.projectId(),
                    session.title(),
                    new ModelResponse(
                            session.provider(),
                            session.model()
                    ),
                    session.status().name(),
                    session.createdAt(),
                    session.updatedAt()
            );
        }
    }

    public record ModelResponse(
            String provider,
            String model
    ) {
    }

    public record TurnResponse(
            String id,
            String status,
            int attemptCount,
            String errorMessage,
            InvocationResponse invocation,
            Instant startedAt,
            Instant finishedAt,
            Long durationMs,
            Instant createdAt,
            Instant updatedAt
    ) {

        static TurnResponse from(Turn turn) {
            return new TurnResponse(
                    turn.id(),
                    turn.status().name(),
                    turn.attemptCount(),
                    turn.errorMessage(),
                    InvocationResponse.from(turn.invocation()),
                    turn.startedAt(),
                    turn.finishedAt(),
                    turn.durationMillis(),
                    turn.createdAt(),
                    turn.updatedAt()
            );
        }
    }

    public record InvocationResponse(
            String provider,
            String model,
            TokenUsageResponse usage,
            String providerRequestId,
            String finishReason
    ) {

        static InvocationResponse from(
                TurnInvocation invocation
        ) {
            if (invocation == null) {
                return null;
            }

            return new InvocationResponse(
                    invocation.provider(),
                    invocation.model(),
                    TokenUsageResponse.from(invocation.usage()),
                    invocation.providerRequestId(),
                    invocation.finishReason()
            );
        }
    }

    public record TokenUsageResponse(
            Long inputTokens,
            Long outputTokens,
            Long totalTokens
    ) {

        static TokenUsageResponse from(
                TurnTokenUsage usage
        ) {
            if (usage == null) {
                return null;
            }

            return new TokenUsageResponse(
                    usage.inputTokens(),
                    usage.outputTokens(),
                    usage.totalTokens()
            );
        }
    }

    public record MessageResponse(
            String id,
            String turnId,
            String role,
            String content,
            long sequence,
            Instant createdAt
    ) {

        static MessageResponse from(SessionMessage message) {
            return new MessageResponse(
                    message.id(),
                    message.turnId(),
                    message.role().name(),
                    message.content(),
                    message.sequence(),
                    message.createdAt()
            );
        }
    }

    public record TurnStartResponse(
            TurnResponse turn,
            MessageResponse userMessage
    ) {

        static TurnStartResponse from(TurnStartResult result) {
            return new TurnStartResponse(
                    TurnResponse.from(result.turn()),
                    MessageResponse.from(result.userMessage())
            );
        }
    }
}
