package io.yakable.boot.controller.session;

import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.AddTurnRequestDTO;
import io.yakable.common.bean.dto.session.QuerySessionChangesDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.vo.session.SessionChangesVO;
import io.yakable.common.bean.vo.session.SessionDetailVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.service.session.SessionService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{projectId}/sessions")
public class SessionController {

    @Resource
    private SessionService sessionService;

    @GetMapping("/{sessionId}")
    public SessionDetailVO querySession(@PathVariable String projectId, @PathVariable String sessionId) {
        return sessionService.querySession(new QuerySessionDTO(projectId, sessionId));
    }

    @GetMapping("/{sessionId}/changes")
    public SessionChangesVO querySessionChanges(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "0") long afterSequence) {
        return sessionService.querySessionChanges(new QuerySessionChangesDTO(projectId, sessionId, afterSequence));
    }

    @GetMapping("/{sessionId}/messages")
    public SessionMessagePageVO querySessionMessages(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(required = false) Long beforeSequence,
            @RequestParam(defaultValue = "50") int limit) {
        return sessionService.querySessionMessage(
                new QuerySessionMessagesDTO(projectId, sessionId, beforeSequence, limit));
    }

    @PostMapping("/{sessionId}/turns")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public TurnStartVO addTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @Valid @RequestBody AddTurnRequestDTO dto) {
        return sessionService.addTurn(new AddTurnDTO(projectId, sessionId, dto.content()));
    }
}
