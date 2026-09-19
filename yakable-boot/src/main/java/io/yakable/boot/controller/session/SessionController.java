package io.yakable.boot.controller.session;

import io.yakable.service.session.SessionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{projectId}/sessions")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/{sessionId}")
    public SessionService.SessionSnapshot getSession(
            @PathVariable String projectId,
            @PathVariable String sessionId
    ) {
        return sessionService.getSnapshot(projectId, sessionId);
    }

    @GetMapping("/{sessionId}/changes")
    public SessionService.SessionChanges getChanges(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "0") long afterSequence
    ) {
        return sessionService.getChanges(
                projectId,
                sessionId,
                afterSequence
        );
    }

    @GetMapping("/{sessionId}/messages")
    public SessionService.MessagePage getMessages(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(required = false) Long beforeSequence,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return sessionService.getMessagePage(
                projectId,
                sessionId,
                beforeSequence,
                limit
        );
    }

    @PostMapping("/{sessionId}/turns")
    public ResponseEntity<SessionService.TurnStart> startTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @Valid @RequestBody StartTurnRequest request
    ) {
        return ResponseEntity.accepted().body(
                sessionService.startTurn(
                        projectId,
                        sessionId,
                        request.content()
                )
        );
    }

    public record StartTurnRequest(
            @NotBlank String content
    ) {
    }
}
