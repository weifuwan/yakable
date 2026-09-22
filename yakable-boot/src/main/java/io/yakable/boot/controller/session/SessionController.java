package io.yakable.boot.controller.session;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.yakable.common.Result;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.AddTurnRequestDTO;
import io.yakable.common.bean.dto.session.StopTurnDTO;
import io.yakable.common.bean.dto.session.QuerySessionChangesDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.vo.session.SessionChangesVO;
import io.yakable.common.bean.vo.session.SessionDetailVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.utils.StringUtils;
import io.yakable.core.llm.LlmStreamEvent;
import io.yakable.service.session.SessionService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

@Tag(name = "Session", description = "Session 会话管理")
@RestController
@RequestMapping("/api/projects/{projectId}/sessions")
public class SessionController {

    @Resource
    private SessionService sessionService;

    @Value("${yakable.sse.timeout:10m}")
    private Duration sseTimeout;

    @Operation(summary = "查询 Session 详情")
    @GetMapping("/{sessionId}")
    public Result<SessionDetailVO> querySession(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(
                sessionService.querySession(new QuerySessionDTO(projectId, sessionId, currentUser.getId())));
    }

    @Operation(summary = "查询 Session 增量变化")
    @GetMapping("/{sessionId}/changes")
    public Result<SessionChangesVO> querySessionChanges(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "0") long afterSequence,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(
                sessionService.querySessionChanges(
                        new QuerySessionChangesDTO(projectId, sessionId, afterSequence, currentUser.getId())));
    }

    @Operation(summary = "查询 Session 消息")
    @GetMapping("/{sessionId}/messages")
    public Result<SessionMessagePageVO> querySessionMessages(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @RequestParam(required = false) Long beforeSequence,
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(
                sessionService.querySessionMessage(
                        new QuerySessionMessagesDTO(
                                projectId, sessionId, beforeSequence, limit, currentUser.getId())));
    }

    @Operation(summary = "新增 Turn")
    @PostMapping("/{sessionId}/turns")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Result<TurnStartVO> addTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @Valid @RequestBody AddTurnRequestDTO dto,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(sessionService.addTurn(
                new AddTurnDTO(
                        projectId, sessionId, dto.provider(), dto.model(), dto.content(), currentUser.getId())));
    }

    @Operation(summary = "停止 Turn")
    @PostMapping("/{sessionId}/turns/{turnId}/stop")
    public Result<TurnVO> stopTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @PathVariable String turnId,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(
                sessionService.stopTurn(
                        new StopTurnDTO(projectId, sessionId, turnId, currentUser.getId())));
    }

    @Operation(summary = "流式新增 Turn")
    @PostMapping(value = "/{sessionId}/turns/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamingTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @Valid @RequestBody AddTurnRequestDTO dto,
            HttpServletResponse response,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        TurnStartVO started = sessionService.addStreamingTurn(
                new AddTurnDTO(
                        projectId, sessionId, dto.provider(), dto.model(), dto.content(), currentUser.getId()));
        SseEmitter emitter = new SseEmitter(sseTimeout.toMillis());
        AtomicBoolean closed = new AtomicBoolean();

        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");
        response.setHeader("X-Accel-Buffering", "no");
        StopTurnDTO stop = new StopTurnDTO(projectId, sessionId, started.getTurn().getId(), currentUser.getId());
        emitter.onCompletion(() -> closed.set(true));
        emitter.onTimeout(() -> {
            sessionService.stopTurn(stop);
            complete(emitter, closed);
        });
        emitter.onError(error -> {
            closed.set(true);
            sessionService.stopTurn(stop);
        });

        send(emitter, closed, "started", started);
        sessionService.executeTurnStreamingAsync(
                started.getTurn().getId(),
                event -> handleStreamEvent(emitter, closed, started.getTurn().getId(), event),
                exception -> handleStreamError(emitter, closed, exception));
        return emitter;
    }

    private static void handleStreamEvent(
            SseEmitter emitter, AtomicBoolean closed, String turnId, LlmStreamEvent event) {
        if (event.type() == LlmStreamEvent.Type.DELTA) {
            send(emitter, closed, "delta", Map.of("content", event.delta()));
            return;
        }
        send(emitter, closed, "complete", Map.of("turnId", turnId));
        complete(emitter, closed);
    }

    private static void handleStreamError(SseEmitter emitter, AtomicBoolean closed, RuntimeException exception) {
        String message = StringUtils.isBlank(exception.getMessage())
                ? "Streaming turn failed."
                : exception.getMessage();
        send(emitter, closed, "error", Map.of("message", message));
        complete(emitter, closed);
    }

    private static void send(SseEmitter emitter, AtomicBoolean closed, String event, Object data) {
        if (closed.get()) {
            return;
        }
        try {
            emitter.send(SseEmitter.event().name(event).data(data));
        } catch (IOException exception) {
            if (closed.compareAndSet(false, true)) {
                emitter.completeWithError(exception);
            }
        }
    }

    private static void complete(SseEmitter emitter, AtomicBoolean closed) {
        if (closed.compareAndSet(false, true)) {
            emitter.complete();
        }
    }
}
