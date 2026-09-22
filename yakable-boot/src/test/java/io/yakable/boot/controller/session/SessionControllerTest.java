package io.yakable.boot.controller.session;

import io.yakable.boot.configuration.exception.GlobalExceptionHandler;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.WatchTurnDTO;
import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.bean.vo.session.TurnInvocationVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.constant.MessageConstant;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.exception.SessionException;
import io.yakable.service.auth.AuthService;
import io.yakable.service.session.SessionService;
import io.yakable.service.session.TurnStreamListener;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = SessionController.class,
        properties = "yakable.sse.timeout=1s")
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SessionService sessionService;

    @MockBean
    private AuthService authService;

    @BeforeEach
    void setCurrentUser() {
        CurrentUserVO user = new CurrentUserVO();
        user.setId("user-1");
        user.setUsername("alice");
        user.setName("Alice");
        user.setRole("USER");
        user.setStatus("ACTIVE");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }

    @AfterEach
    void clearCurrentUser() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldAcceptNewTurnForCurrentUser() throws Exception {
        when(sessionService.addTurn(any(AddTurnDTO.class))).thenReturn(turnStart("turn-1", "message-1"));

        mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Tell me more",
                                  "provider": "kimi",
                                  "model": "kimi-k3",
                                  "requestId": "turn-request-1"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.turn.id").value("turn-1"))
                .andExpect(jsonPath("$.data.userMessage.id").value("message-1"));

        ArgumentCaptor<AddTurnDTO> captor = ArgumentCaptor.forClass(AddTurnDTO.class);
        verify(sessionService).addTurn(captor.capture());
        assertThat(captor.getValue().projectId()).isEqualTo("project-1");
        assertThat(captor.getValue().sessionId()).isEqualTo("session-1");
        assertThat(captor.getValue().provider()).isEqualTo("kimi");
        assertThat(captor.getValue().model()).isEqualTo("kimi-k3");
        assertThat(captor.getValue().content()).isEqualTo("Tell me more");
        assertThat(captor.getValue().requestId()).isEqualTo("turn-request-1");
        assertThat(captor.getValue().userId()).isEqualTo("user-1");
    }

    @Test
    void shouldRejectOversizedTurnContent() throws Exception {
        String oversized = "x".repeat(MessageConstant.MAX_CONTENT_LENGTH + 1);

        mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "%s",
                                  "provider": "deepseek",
                                  "model": "deepseek-flash",
                                  "requestId": "turn-request-oversized"
                                }
                                """.formatted(oversized)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000));

        verify(sessionService, never()).addTurn(any());
    }

    @Test
    void shouldRejectBlankTurnContent() throws Exception {
        mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": " ",
                                  "provider": "deepseek",
                                  "model": "deepseek-flash",
                                  "requestId": "turn-request-2"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000));
    }

    @Test
    void shouldMapBusySessionToConflict() throws Exception {
        when(sessionService.addTurn(any(AddTurnDTO.class)))
                .thenThrow(new SessionException(SessionErrorCode.BUSY));

        mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Tell me more",
                                  "provider": "deepseek",
                                  "model": "deepseek-flash",
                                  "requestId": "turn-request-3"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(10002))
                .andExpect(jsonPath("$.message").value("Session already has an active turn"));
    }

    @Test
    void shouldMapRequestIdConflictToConflict() throws Exception {
        when(sessionService.addTurn(any(AddTurnDTO.class)))
                .thenThrow(new SessionException(SessionErrorCode.REQUEST_CONFLICT));

        mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Different prompt",
                                  "provider": "deepseek",
                                  "model": "deepseek-flash",
                                  "requestId": "turn-request-existing"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(10003))
                .andExpect(jsonPath("$.message").value("Request id conflicts with an existing turn"));
    }

    @Test
    void shouldStopTurnForCurrentUser() throws Exception {
        TurnVO stopped = new TurnVO();
        stopped.setId("turn-1");
        stopped.setStatus("STOPPED");
        when(sessionService.stopTurn(any())).thenReturn(stopped);

        mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns/turn-1/stop"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("STOPPED"));
    }

    @Test
    void shouldExposeStartedDeltaAndCompleteAsSseEventsForCurrentUser() throws Exception {
        TurnStartVO started = turnStart("turn-1", "message-1");
        when(sessionService.addStreamingTurn(any(AddTurnDTO.class))).thenReturn(started);

        when(sessionService.watchTurn(any(WatchTurnDTO.class), any(TurnStreamListener.class)))
                .thenAnswer(invocation -> {
                    TurnStreamListener listener = invocation.getArgument(1);
                    listener.onDelta("Hello");
                    listener.onComplete();
                    return (Runnable) () -> {
                    };
                });

        MvcResult result = mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns/stream")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Say hello",
                                  "provider": "deepseek",
                                  "model": "deepseek-flash",
                                  "requestId": "turn-request-4"
                                }
                                """))
                .andExpect(request().asyncStarted())
                .andReturn();

        ArgumentCaptor<AddTurnDTO> captor = ArgumentCaptor.forClass(AddTurnDTO.class);
        verify(sessionService).addStreamingTurn(captor.capture());
        assertThat(captor.getValue().requestId()).isEqualTo("turn-request-4");
        assertThat(captor.getValue().userId()).isEqualTo("user-1");
        verify(sessionService).executeTurnAsync("turn-1");

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andExpect(content().string(containsString("event:started")))
                .andExpect(content().string(containsString("event:delta")))
                .andExpect(content().string(containsString("Hello")))
                .andExpect(content().string(containsString("event:complete")))
                .andExpect(content().string(containsString("turn-1")));
    }

    @Test
    void shouldWatchExistingTurnWithoutStoppingIt() throws Exception {
        when(sessionService.watchTurn(any(WatchTurnDTO.class), any(TurnStreamListener.class)))
                .thenAnswer(invocation -> {
                    TurnStreamListener listener = invocation.getArgument(1);
                    listener.onSnapshot("Partial");
                    listener.onDelta(" answer");
                    listener.onComplete();
                    return (Runnable) () -> {
                    };
                });

        MvcResult result = mockMvc.perform(
                        post("/api/projects/project-1/sessions/session-1/turns/turn-1/stream"))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("event:snapshot")))
                .andExpect(content().string(containsString("Partial")))
                .andExpect(content().string(containsString("event:delta")))
                .andExpect(content().string(containsString("answer")))
                .andExpect(content().string(containsString("event:complete")));

        verify(sessionService, never()).stopTurn(any());
    }

    private static TurnStartVO turnStart(String turnId, String messageId) {
        TurnInvocationVO invocation = new TurnInvocationVO();
        invocation.setProvider("deepseek");
        invocation.setModel("deepseek-flash");

        TurnVO turn = new TurnVO();
        turn.setId(turnId);
        turn.setStatus("PENDING");
        turn.setAttemptCount(0);
        turn.setInvocation(invocation);
        turn.setCreatedAt(LocalDateTime.of(2026, 9, 21, 9, 0));
        turn.setUpdatedAt(LocalDateTime.of(2026, 9, 21, 9, 0));

        MessageVO message = new MessageVO();
        message.setId(messageId);
        message.setTurnId(turnId);
        message.setRole(MessageRoleEnum.USER.name());
        message.setContent("Tell me more");
        message.setSequence(1L);
        message.setCreatedAt(LocalDateTime.of(2026, 9, 21, 9, 0));

        TurnStartVO result = new TurnStartVO();
        result.setTurn(turn);
        result.setUserMessage(message);
        return result;
    }
}
