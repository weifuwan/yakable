package io.yakable.boot.controller.session;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.yakable.common.Result;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.AddTurnRequestDTO;
import io.yakable.common.bean.dto.session.StopTurnDTO;
import io.yakable.common.bean.dto.session.WatchTurnDTO;
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
import io.yakable.service.session.TurnStreamListener;
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
import java.util.concurrent.atomic.AtomicReference;
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

        SseEmitter emitter = newEmitter(response);
        AtomicBoolean closed = new AtomicBoolean();
        send(emitter, closed, "started", started);

        watchTurn(
                emitter,
                closed,
                new WatchTurnDTO(projectId, sessionId, started.getTurn().getId(), currentUser.getId()));
        sessionService.executeTurnAsync(started.getTurn().getId());
        return emitter;
    }

    @Operation(summary = "订阅已有 Turn 流式输出")
    @PostMapping(value = "/{sessionId}/turns/{turnId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter watchTurn(
            @PathVariable String projectId,
            @PathVariable String sessionId,
            @PathVariable String turnId,
            HttpServletResponse response,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        SseEmitter emitter = newEmitter(response);
        AtomicBoolean closed = new AtomicBoolean();
        watchTurn(
                emitter,
                closed,
                new WatchTurnDTO(projectId, sessionId, turnId, currentUser.getId()));
        return emitter;
    }

    private SseEmitter newEmitter(HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");
        response.setHeader("X-Accel-Buffering", "no");
        return new SseEmitter(sseTimeout.toMillis());
    }

    private void watchTurn(SseEmitter emitter, AtomicBoolean closed, WatchTurnDTO dto) {
        AtomicReference<Runnable> unsubscribe = new AtomicReference<>(() -> {
        });

        Runnable cleanup = () -> unsubscribe.get().run();
        emitter.onCompletion(() -> {
            closed.set(true);
            cleanup.run();
        });
        emitter.onTimeout(() -> {
            cleanup.run();
            complete(emitter, closed);
        });
        emitter.onError(error -> {
            closed.set(true);
            cleanup.run();
        });

        TurnStreamListener listener = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
                send(emitter, closed, "snapshot", Map.of("content", content));
            }

            @Override
            public void onDelta(String content) {
                send(emitter, closed, "delta", Map.of("content", content));
            }

            @Override
            public void onComplete() {
                send(emitter, closed, "complete", Map.of("turnId", dto.turnId()));
                complete(emitter, closed);
            }

            @Override
            public void onError(String message) {
                send(
                        emitter,
                        closed,
                        "error",
                        Map.of("message", StringUtils.isBlank(message) ? "Streaming turn failed." : message));
                complete(emitter, closed);
            }

            @Override
            public void onStopped() {
                send(emitter, closed, "stopped", Map.of("turnId", dto.turnId()));
                complete(emitter, closed);
            }
        };

        Runnable current = sessionService.watchTurn(dto, listener);
        unsubscribe.set(current);
        if (closed.get()) {
            current.run();
        }
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
