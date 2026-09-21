package io.yakable.boot.controller.session;

import io.yakable.boot.configuration.exception.GlobalExceptionHandler;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.exception.SessionException;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmStreamEvent;
import io.yakable.core.llm.LlmUsage;
import io.yakable.service.session.SessionService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
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
@Import(GlobalExceptionHandler.class)
class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SessionService sessionService;

    @Test
    void shouldAcceptNewTurn() throws Exception {
        when(sessionService.addTurn(any(AddTurnDTO.class))).thenReturn(turnStart("turn-1", "message-1"));

        mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Tell me more",
                                  "provider": "kimi",
                                  "model": "kimi-k3"
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
    }

    @Test
    void shouldRejectBlankTurnContent() throws Exception {
        mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": " ",
                                  "provider": "deepseek",
                                  "model": "deepseek-flash"
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
                                  "model": "deepseek-flash"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(10002))
                .andExpect(jsonPath("$.message").value("Session already has an active turn"));
    }

    @Test
    void shouldExposeStartedDeltaAndCompleteAsSseEvents() throws Exception {
        TurnStartVO started = turnStart("turn-1", "message-1");
        when(sessionService.addStreamingTurn(any(AddTurnDTO.class))).thenReturn(started);

        doAnswer(invocation -> {
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.delta("Hello"));
            consumer.accept(LlmStreamEvent.complete(new LlmResponse(
                    "deepseek",
                    "deepseek-flash",
                    "Hello",
                    new LlmUsage(10L, 2L, 12L),
                    "req-1",
                    "stop")));
            return null;
        }).when(sessionService).executeTurnStreamingAsync(eq("turn-1"), any(), any());

        MvcResult result = mockMvc.perform(post("/api/projects/project-1/sessions/session-1/turns/stream")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Say hello",
                                  "provider": "deepseek",
                                  "model": "deepseek-flash"
                                }
                                """))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andExpect(content().string(containsString("event:started")))
                .andExpect(content().string(containsString("event:delta")))
                .andExpect(content().string(containsString("Hello")))
                .andExpect(content().string(containsString("event:complete")))
                .andExpect(content().string(containsString("turn-1")));
    }

    private static TurnStartVO turnStart(String turnId, String messageId) {
        TurnVO turn = new TurnVO();
        turn.setId(turnId);
        turn.setStatus("PENDING");
        turn.setAttemptCount(0);
        turn.setCreatedAt(LocalDateTime.of(2026, 9, 21, 9, 0));
        turn.setUpdatedAt(LocalDateTime.of(2026, 9, 21, 9, 0));

        MessageVO message = new MessageVO();
        message.setId(messageId);
        message.setTurnId(turnId);
        message.setRole("USER");
        message.setContent("Tell me more");
        message.setSequence(1L);
        message.setCreatedAt(LocalDateTime.of(2026, 9, 21, 9, 0));

        TurnStartVO result = new TurnStartVO();
        result.setTurn(turn);
        result.setUserMessage(message);
        return result;
    }
}
