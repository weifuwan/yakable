package io.yakable.boot.session;

import io.yakable.core.session.Session;
import io.yakable.core.session.SessionBusyException;
import io.yakable.core.session.SessionCommandService;
import io.yakable.core.session.SessionMessage;
import io.yakable.core.session.SessionNotFoundException;
import io.yakable.core.session.SessionQueryService;
import io.yakable.core.session.SessionSnapshot;
import io.yakable.core.session.Turn;
import io.yakable.core.session.TurnStartResult;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/sessions")
public class SessionController {

    private final SessionCommandService commandService;
    private final SessionQueryService queryService;
    private final SessionTurnDispatcher turnDispatcher;

    public SessionController(
            SessionCommandService commandService,
            SessionQueryService queryService,
            SessionTurnDispatcher turnDispatcher
    ) {
        this.commandService = commandService;
        this.queryService = queryService;
        this.turnDispatcher = turnDispatcher;
    }

    @GetMapping("/{sessionId}")
    public SessionSnapshotResponse getSession(
            @PathVariable String projectId,
            @PathVariable String sessionId
    ) {
        try {
            return SessionSnapshotResponse.from(
                    queryService.getSnapshot(projectId, sessionId)
            );
        } catch (SessionNotFoundException exception) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    exception.getMessage(),
                    exception
            );
        }
    }

    @PostMapping("/{sessionId}/turns")
    public ResponseEntity<TurnStartResponse> startTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestBody StartTurnRequest request
    ) {
        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "content is required"
            );
        }

        TurnStartResult result;
        try {
            result = commandService.startTurn(
                    projectId,
                    sessionId,
                    request.content()
            );
        } catch (SessionNotFoundException exception) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    exception.getMessage(),
                    exception
            );
        } catch (SessionBusyException | IllegalStateException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    exception.getMessage(),
                    exception
            );
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    exception.getMessage(),
                    exception
            );
        }

        turnDispatcher.dispatch(result.turn().id());

        return ResponseEntity
                .accepted()
                .body(TurnStartResponse.from(result));
    }

    public record StartTurnRequest(String content) {
    }

    public record SessionSnapshotResponse(
            SessionResponse session,
            List<TurnResponse> turns,
            List<MessageResponse> messages
    ) {

        static SessionSnapshotResponse from(SessionSnapshot snapshot) {
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
            String errorMessage,
            Instant createdAt,
            Instant updatedAt
    ) {

        static TurnResponse from(Turn turn) {
            return new TurnResponse(
                    turn.id(),
                    turn.status().name(),
                    turn.errorMessage(),
                    turn.createdAt(),
                    turn.updatedAt()
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
