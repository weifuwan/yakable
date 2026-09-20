package io.yakable.boot.controller.session;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.yakable.common.Result;
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

@Tag(name = "Session", description = "Session 会话管理")
@RestController
@RequestMapping("/api/projects/{projectId}/sessions")
public class SessionController {

    @Resource
    private SessionService sessionService;

    @Operation(summary = "查询 Session 详情")
    @GetMapping("/{sessionId}")
    public Result<SessionDetailVO> querySession(@PathVariable String projectId, @PathVariable String sessionId) {
        return Result.success(sessionService.querySession(new QuerySessionDTO(projectId, sessionId)));
    }

    @Operation(summary = "查询 Session 增量变化")
    @GetMapping("/{sessionId}/changes")
    public Result<SessionChangesVO> querySessionChanges(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "0") long afterSequence) {
        return Result.success(
                sessionService.querySessionChanges(new QuerySessionChangesDTO(projectId, sessionId, afterSequence)));
    }

    @Operation(summary = "查询 Session 消息")
    @GetMapping("/{sessionId}/messages")
    public Result<SessionMessagePageVO> querySessionMessages(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(required = false) Long beforeSequence,
            @RequestParam(defaultValue = "50") int limit) {
        return Result.success(
                sessionService.querySessionMessage(
                        new QuerySessionMessagesDTO(projectId, sessionId, beforeSequence, limit)));
    }

    @Operation(summary = "新增 Turn")
    @PostMapping("/{sessionId}/turns")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Result<TurnStartVO> addTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @Valid @RequestBody AddTurnRequestDTO dto) {
        return Result.success(sessionService.addTurn(new AddTurnDTO(projectId, sessionId, dto.content())));
    }
}
