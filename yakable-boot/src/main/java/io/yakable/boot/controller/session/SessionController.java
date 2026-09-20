package io.yakable.boot.controller.session;

import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.QuerySessionChangesDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.vo.session.SessionChangesVO;
import io.yakable.common.bean.vo.session.SessionDetailVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
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
    public SessionDetailVO getSession(@PathVariable String projectId, @PathVariable String sessionId) {
        return sessionService.querySession(new QuerySessionDTO(projectId, sessionId));
    }

    @GetMapping("/{sessionId}/changes")
    public SessionChangesVO getChanges(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "0") long afterSequence) {
        return sessionService.querySessionChanges(new QuerySessionChangesDTO(projectId, sessionId, afterSequence));
    }

    @GetMapping("/{sessionId}/messages")
    public SessionMessagePageVO getMessages(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(required = false) Long beforeSequence,
            @RequestParam(defaultValue = "50") int limit) {
        return sessionService.querySessionMessage(
                new QuerySessionMessagesDTO(projectId, sessionId, beforeSequence, limit));
    }

    @PostMapping("/{sessionId}/turns")
    public ResponseEntity<TurnStartVO> startTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @Valid @RequestBody StartTurnRequest request) {
        TurnStartVO result = sessionService.addTurn(new AddTurnDTO(projectId, sessionId, request.content()));
        return ResponseEntity.accepted().body(result);
    }

    public record StartTurnRequest(@NotBlank String content) {
    }
}
