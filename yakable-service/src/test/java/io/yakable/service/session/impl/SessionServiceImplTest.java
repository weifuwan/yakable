package io.yakable.service.session.impl;

import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.StopTurnDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnInvocationVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.exception.SessionException;
import io.yakable.core.llm.LlmClient;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmModelMetadata;
import io.yakable.core.llm.LlmRequest;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.message.MessageService;
import io.yakable.service.turn.TurnService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionServiceImplTest {

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private TurnService turnService;

    @Mock
    private MessageService messageService;

    @Mock
    private LlmClient llmClient;

    @Mock
    private TransactionTemplate transactionTemplate;

    @InjectMocks
    private SessionServiceImpl sessionService;

    @Test
    void shouldCreateInitialSessionForProjectOwner() {
        SessionEntity session = session("project-1", "session-1");
        TurnVO turn = turn("turn-1", TurnStatusEnum.PENDING, "deepseek", "deepseek-flash");
        MessageVO message = message("message-1", "turn-1", MessageRoleEnum.USER, "Hello", 1L);

        when(sessionRepository.querySessionForUpdate(any())).thenReturn(true);
        when(turnService.queryActiveTurnCount(any())).thenReturn(0L);
        when(turnService.addTurn(any(), any(), any())).thenReturn(turn);
        when(messageService.addMessage(any(), any(), eq(MessageRoleEnum.USER), eq("Hello"))).thenReturn(message);

        sessionService.addSession(
                new AddSessionDTO(
                        "project-1", "CRM", "deepseek", "deepseek-flash", "Hello", "user-1"));

        ArgumentCaptor<SessionEntity> captor = ArgumentCaptor.forClass(SessionEntity.class);
        verify(sessionRepository).add(captor.capture());
        assertThat(captor.getValue().getProjectId()).isEqualTo("project-1");
        assertThat(captor.getValue().getCreateBy()).isEqualTo("user-1");
    }

    @Test
    void shouldRejectSessionOwnedByAnotherUser() {
        when(sessionRepository.querySession("project-1", "session-1", "user-2"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                sessionService.querySession(new QuerySessionDTO("project-1", "session-1", "user-2")))
                .isInstanceOf(SessionException.class)
                .satisfies(exception ->
                        assertThat(((SessionException) exception).getErrorCode()).isEqualTo(SessionErrorCode.NOT_FOUND));

        verify(sessionRepository).querySession("project-1", "session-1", "user-2");
        verifyNoInteractions(turnService, messageService);
    }

    @Test
    void shouldCreatePendingTurnForActiveSession() {
        stubExecuteInline();

        SessionEntity session = session("project-1", "session-1");
        TurnVO turn = turn("turn-1", TurnStatusEnum.PENDING, "kimi", "kimi-k3");
        MessageVO message = message("message-1", "turn-1", MessageRoleEnum.USER, "Hello", 1L);

        when(sessionRepository.querySession("project-1", "session-1", "user-1")).thenReturn(Optional.of(session));
        when(sessionRepository.querySessionForUpdate("session-1")).thenReturn(true);
        when(turnService.queryActiveTurnCount("session-1")).thenReturn(0L);
        when(turnService.addTurn("session-1", "kimi", "kimi-k3")).thenReturn(turn);
        when(messageService.addMessage("session-1", "turn-1", MessageRoleEnum.USER, "Hello")).thenReturn(message);

        TurnStartVO result = sessionService.addStreamingTurn(new AddTurnDTO("project-1", "session-1", "kimi", "kimi-k3", "Hello", "user-1"));

        assertThat(result.getTurn()).isSameAs(turn);
        assertThat(result.getUserMessage()).isSameAs(message);
        verify(turnService).addTurn("session-1", "kimi", "kimi-k3");
        assertThat(session.getProvider()).isEqualTo("kimi");
        assertThat(session.getModel()).isEqualTo("kimi-k3");
        assertThat(session.getActivityTime()).isEqualTo(message.getCreatedAt());
        verify(sessionRepository).update(session);
    }

    @Test
    void shouldRejectTurnWhenSessionAlreadyHasActiveTurn() {
        stubExecuteInline();

        SessionEntity session = session("project-1", "session-1");
        when(sessionRepository.querySession("project-1", "session-1", "user-1")).thenReturn(Optional.of(session));
        when(sessionRepository.querySessionForUpdate("session-1")).thenReturn(true);
        when(turnService.queryActiveTurnCount("session-1")).thenReturn(1L);

        assertThatThrownBy(() ->
                sessionService.addStreamingTurn(new AddTurnDTO("project-1", "session-1", "kimi", "kimi-k3", "Hello", "user-1")))
                .isInstanceOf(SessionException.class)
                .satisfies(exception ->
                        assertThat(((SessionException) exception).getErrorCode()).isEqualTo(SessionErrorCode.BUSY));

        verify(turnService, never()).addTurn(any(), any(), any());
        verifyNoInteractions(messageService);
    }

    @Test
    void shouldNotChangeSessionActivityWhenTurnIsStopped() {
        stubExecuteInline();

        SessionEntity session = session("project-1", "session-1");
        TurnExecutionVO execution = execution("turn-1", "session-1");
        TurnVO stopped = turn("turn-1", TurnStatusEnum.STOPPED);

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurnExecution("turn-1")).thenReturn(Optional.of(execution));
        when(turnService.updateTurnStopped(eq("turn-1"), eq("session-1"), any(LocalDateTime.class)))
                .thenReturn(1);
        when(turnService.queryTurn("turn-1")).thenReturn(Optional.of(stopped));

        sessionService.stopTurn(
                new StopTurnDTO("project-1", "session-1", "turn-1", "user-1"));

        verify(sessionRepository, never()).update(any());
    }

    @Test
    void shouldPageMessagesInDisplayOrderAndExposeNextCursor() {
        SessionEntity session = session("project-1", "session-1");
        when(sessionRepository.querySession("project-1", "session-1", "user-1")).thenReturn(Optional.of(session));
        when(messageService.queryMessageBefore("session-1", 10L, 3)).thenReturn(List.of(
                message("message-9", "turn-3", MessageRoleEnum.ASSISTANT, "nine", 9L),
                message("message-8", "turn-3", MessageRoleEnum.USER, "eight", 8L),
                message("message-7", "turn-2", MessageRoleEnum.ASSISTANT, "seven", 7L)));

        SessionMessagePageVO result = sessionService.querySessionMessage(
                new QuerySessionMessagesDTO("project-1", "session-1", 10L, 2, "user-1"));

        assertThat(result.isHasMore()).isTrue();
        assertThat(result.getNextBeforeSequence()).isEqualTo(8L);
        assertThat(result.getMessages())
                .extracting(MessageVO::getSequence)
                .containsExactly(8L, 9L);
    }

    @Test
    void shouldExecuteTurnWithItsOwnModelInsteadOfSessionDefault() throws Exception {
        String currentTurnId = "turn-current";
        SessionEntity session = session("project-1", "session-1");
        session.setProvider("deepseek");
        session.setModel("deepseek-flash");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING, "kimi", "kimi-k3");

        when(turnService.queryTurnExecution(currentTurnId))
                .thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        when(messageService.queryMessageList("session-1")).thenReturn(List.of(
                message("m1", currentTurnId, MessageRoleEnum.USER, "Hello", 1L)));
        when(turnService.queryTurnList("session-1")).thenReturn(List.of(current));
        when(llmClient.modelMetadata("kimi", "kimi-k3")).thenReturn(Optional.empty());

        AtomicReference<LlmRequest> capturedRequest = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        doAnswer(invocation -> {
            capturedRequest.set(invocation.getArgument(0));
            done.countDown();
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnStreamingAsync(
                currentTurnId,
                event -> {
                },
                exception -> done.countDown());

        assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(capturedRequest.get()).isNotNull();
        assertThat(capturedRequest.get().provider()).isEqualTo("kimi");
        assertThat(capturedRequest.get().model()).isEqualTo("kimi-k3");
    }

    @Test
    void shouldTrimOlderTurnsUsingModelTokenBudget() throws Exception {
        ReflectionTestUtils.setField(sessionService, "maxHistoryTurns", 20);

        String currentTurnId = "turn-current";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);
        TurnVO recent = turn("turn-recent", TurnStatusEnum.SUCCEEDED);
        TurnVO oldest = turn("turn-oldest", TurnStatusEnum.SUCCEEDED);

        when(turnService.queryTurnExecution(currentTurnId)).thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        when(messageService.queryMessageList("session-1")).thenReturn(List.of(
                message("m1", "turn-oldest", MessageRoleEnum.USER, "old user", 1L),
                message("m2", "turn-oldest", MessageRoleEnum.ASSISTANT, "old assistant", 2L),
                message("m3", "turn-recent", MessageRoleEnum.USER, "recent user", 3L),
                message("m4", "turn-recent", MessageRoleEnum.ASSISTANT, "recent assistant", 4L),
                message("m5", currentTurnId, MessageRoleEnum.USER, "current user", 5L)));
        when(turnService.queryTurnList("session-1")).thenReturn(List.of(oldest, recent, current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(Optional.of(new LlmModelMetadata(100L, 20L)));
        when(llmClient.estimateTokens(any(LlmRequest.class))).thenAnswer(invocation -> {
            LlmRequest request = invocation.getArgument(0);
            return switch (request.messages().size()) {
                case 1 -> 30L;
                case 3 -> 70L;
                default -> 110L;
            };
        });

        AtomicReference<LlmRequest> capturedRequest = new AtomicReference<>();
        AtomicReference<RuntimeException> failure = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        doAnswer(invocation -> {
            capturedRequest.set(invocation.getArgument(0));
            done.countDown();
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnStreamingAsync(
                currentTurnId,
                event -> {
                },
                exception -> {
                    failure.set(exception);
                    done.countDown();
                });

        assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(failure.get()).isNull();
        assertThat(capturedRequest.get()).isNotNull();
        assertThat(capturedRequest.get().messages())
                .extracting(LlmMessage::content)
                .containsExactly("recent user", "recent assistant", "current user");
    }

    @Test
    void shouldRejectCurrentTurnWhenItExceedsModelContextBudget() throws Exception {
        stubExecuteWithoutResultInline();

        String currentTurnId = "turn-too-large";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);

        when(turnService.queryTurnExecution(currentTurnId)).thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        when(messageService.queryMessageList("session-1")).thenReturn(List.of(
                message("m1", currentTurnId, MessageRoleEnum.USER, "oversized current message", 1L)));
        when(turnService.queryTurnList("session-1")).thenReturn(List.of(current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(Optional.of(new LlmModelMetadata(100L, 20L)));
        when(llmClient.estimateTokens(any(LlmRequest.class))).thenReturn(81L);
        when(turnService.queryTurn(currentTurnId)).thenReturn(Optional.of(current));

        AtomicReference<RuntimeException> failure = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);

        sessionService.executeTurnStreamingAsync(
                currentTurnId,
                event -> {
                },
                exception -> {
                    failure.set(exception);
                    done.countDown();
                });

        assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(failure.get()).isInstanceOf(SessionException.class);
        assertThat(((SessionException) failure.get()).getErrorCode()).isEqualTo(SessionErrorCode.CONTEXT_TOO_LARGE);
        verify(llmClient, never()).streamingChat(any(), any());
    }

    @Test
    void shouldPersistFailureWhenStreamingProviderFails() throws Exception {
        stubExecuteWithoutResultInline();
        ReflectionTestUtils.setField(sessionService, "maxHistoryTurns", 0);

        String currentTurnId = "turn-failed";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);
        RuntimeException providerFailure = new RuntimeException("provider down");

        when(turnService.queryTurnExecution(currentTurnId)).thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        when(messageService.queryMessageList("session-1")).thenReturn(List.of(
                message("m1", currentTurnId, MessageRoleEnum.USER, "Hello", 1L)));
        when(turnService.queryTurnList("session-1")).thenReturn(List.of(current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash")).thenReturn(Optional.empty());
        when(turnService.queryTurn(currentTurnId)).thenReturn(Optional.of(current));
        doThrow(providerFailure).when(llmClient).streamingChat(any(LlmRequest.class), any());

        AtomicReference<RuntimeException> failure = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);

        sessionService.executeTurnStreamingAsync(
                currentTurnId,
                event -> {
                },
                exception -> {
                    failure.set(exception);
                    done.countDown();
                });

        assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(failure.get()).isSameAs(providerFailure);
        verify(turnService).updateTurnFailed(
                eq(currentTurnId),
                eq("session-1"),
                eq("provider down"),
                any(LocalDateTime.class));
        verify(sessionRepository, never()).update(any());
    }

    private void stubExecuteInline() {
        doAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        }).when(transactionTemplate).execute(any(TransactionCallback.class));
    }

    private void stubExecuteWithoutResultInline() {
        doAnswer(invocation -> {
            Consumer<TransactionStatus> action = invocation.getArgument(0);
            action.accept(mock(TransactionStatus.class));
            return null;
        }).when(transactionTemplate).executeWithoutResult(any());
    }

    private static SessionEntity session(String projectId, String sessionId) {
        SessionEntity session = new SessionEntity();
        session.setId(sessionId);
        session.setProjectId(projectId);
        session.setTitle("CRM");
        session.setProvider("deepseek");
        session.setModel("deepseek-flash");
        session.setCreateBy("user-1");
        session.setUpdateBy("user-1");
        session.setCreateTime(LocalDateTime.of(2026, 9, 21, 9, 0));
        session.setUpdateTime(LocalDateTime.of(2026, 9, 21, 9, 0));
        session.setActivityTime(LocalDateTime.of(2026, 9, 21, 9, 0));
        return session;
    }

    private static TurnExecutionVO execution(String turnId, String sessionId) {
        TurnExecutionVO execution = new TurnExecutionVO();
        execution.setId(turnId);
        execution.setSessionId(sessionId);
        execution.setProvider("deepseek");
        execution.setModel("deepseek-flash");
        return execution;
    }

    private static TurnVO turn(String turnId, TurnStatusEnum status) {
        return turn(turnId, status, "deepseek", "deepseek-flash");
    }

    private static TurnVO turn(
            String turnId, TurnStatusEnum status, String provider, String model) {
        TurnInvocationVO invocation = new TurnInvocationVO();
        invocation.setProvider(provider);
        invocation.setModel(model);

        TurnVO turn = new TurnVO();
        turn.setId(turnId);
        turn.setStatus(status.name());
        turn.setAttemptCount(1);
        turn.setInvocation(invocation);
        return turn;
    }

    private static MessageVO message(
            String messageId, String turnId, MessageRoleEnum role, String content, long sequence) {
        MessageVO message = new MessageVO();
        message.setId(messageId);
        message.setTurnId(turnId);
        message.setRole(role.name());
        message.setContent(content);
        message.setSequence(sequence);
        message.setCreatedAt(LocalDateTime.of(2026, 9, 21, 9, 0).plusSeconds(sequence));
        return message;
    }
}
