package io.yakable.service.session.impl;

import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.StopTurnDTO;
import io.yakable.common.bean.dto.session.WatchTurnDTO;
import io.yakable.common.bean.dto.session.QuerySessionChangesDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessageWindowDTO;
import io.yakable.common.bean.dto.session.QuerySessionTurnNavigationDTO;
import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.SessionMessageWindowVO;
import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnInvocationVO;
import io.yakable.common.bean.vo.session.TurnNavigationItemVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.constant.MessageConstant;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.enums.session.TurnTypeEnum;
import io.yakable.common.exception.SessionException;
import io.yakable.core.conversation.stream.TurnStreamListener;
import io.yakable.core.conversation.stream.TurnStreamRuntime;
import io.yakable.core.llm.LlmClient;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmModelMetadata;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmStreamEvent;
import io.yakable.core.llm.LlmUsage;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.message.MessageService;
import io.yakable.service.observability.ConversationMetrics;
import io.yakable.service.turn.TurnService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
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

    @Mock
    private ConversationMetrics conversationMetrics;

    @Spy
    private TurnStreamRuntime turnStreamRuntime = new TurnStreamRuntime();

    @InjectMocks
    private SessionServiceImpl sessionService;

    @Test
    void shouldNotDispatchNewTurnWhileRuntimeIsShuttingDown() {
        AtomicBoolean shuttingDown =
                (AtomicBoolean) ReflectionTestUtils.getField(sessionService, "shuttingDown");
        assertThat(shuttingDown).isNotNull();
        shuttingDown.set(true);

        sessionService.executeTurnAsync("turn-1");

        verifyNoInteractions(turnService, sessionRepository);
    }

    @Test
    void shouldCreateInitialSessionForProjectOwner() {
        SessionEntity session = session("project-1", "session-1");
        TurnVO turn = turn("turn-1", TurnStatusEnum.PENDING, "deepseek", "deepseek-flash");
        MessageVO message = message("message-1", "turn-1", MessageRoleEnum.USER, "Hello", 1L);

        when(sessionRepository.querySessionForUpdate(any())).thenReturn(true);
        when(turnService.queryActiveTurnCount(any())).thenReturn(0L);
        when(turnService.addTurn(any(), any(), any(), any(), any())).thenReturn(turn);
        when(messageService.addMessage(any(), any(), eq(MessageRoleEnum.USER), eq("Hello"))).thenReturn(message);

        sessionService.addSession(
                new AddSessionDTO(
                        "project-1", "CRM", "deepseek", "deepseek-flash", TurnTypeEnum.PROJECT_GENERATION,
                        "Hello", "initial-request-1", "user-1"));

        ArgumentCaptor<SessionEntity> captor = ArgumentCaptor.forClass(SessionEntity.class);
        verify(sessionRepository).add(captor.capture());
        assertThat(captor.getValue().getProjectId()).isEqualTo("project-1");
        assertThat(captor.getValue().getCreateBy()).isEqualTo("user-1");
        verify(turnService).addTurn(
                any(), eq(TurnTypeEnum.PROJECT_GENERATION), any(), any(), any());
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
        when(turnService.addTurn("session-1", TurnTypeEnum.CHAT, "kimi", "kimi-k3", "turn-request-1")).thenReturn(turn);
        when(messageService.addMessage("session-1", "turn-1", MessageRoleEnum.USER, "Hello")).thenReturn(message);

        TurnStartVO result = sessionService.addStreamingTurn(new AddTurnDTO("project-1", "session-1", "kimi", "kimi-k3", "Hello", "turn-request-1", "user-1"));

        assertThat(result.getTurn()).isSameAs(turn);
        assertThat(result.getUserMessage()).isSameAs(message);
        verify(turnService).addTurn("session-1", "kimi", "kimi-k3", "turn-request-1");
        assertThat(session.getProvider()).isEqualTo("kimi");
        assertThat(session.getModel()).isEqualTo("kimi-k3");
        assertThat(session.getActivityTime()).isEqualTo(message.getCreatedAt());
        verify(sessionRepository).update(session);
    }

    @Test
    void shouldReturnExistingTurnForRepeatedRequest() {
        stubExecuteInline();

        SessionEntity session = session("project-1", "session-1");
        TurnVO existing = turn("turn-existing", TurnStatusEnum.SUCCEEDED, "deepseek", "deepseek-flash");
        MessageVO userMessage = message(
                "message-existing", "turn-existing", MessageRoleEnum.USER, "Hello", 1L);

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(sessionRepository.querySessionForUpdate("session-1")).thenReturn(true);
        when(turnService.queryTurnByRequestId("session-1", "turn-request-existing"))
                .thenReturn(Optional.of(existing));
        when(messageService.queryUserMessage("turn-existing"))
                .thenReturn(Optional.of(userMessage));

        TurnStartVO result = sessionService.addStreamingTurn(new AddTurnDTO(
                "project-1", "session-1", "deepseek", "deepseek-flash",
                "Hello", "turn-request-existing", "user-1"));

        assertThat(result.getTurn()).isSameAs(existing);
        assertThat(result.getUserMessage()).isSameAs(userMessage);
        verify(conversationMetrics).idempotencyReplay("turn");
        verify(turnService, never()).addTurn(any(), any(), any(), any());
        verify(messageService, never()).addMessage(any(), any(), any(), any());
        verify(sessionRepository, never()).update(any());
    }

    @Test
    void shouldRejectRepeatedRequestWhenSubmissionSemanticsChanged() {
        stubExecuteInline();

        SessionEntity session = session("project-1", "session-1");
        TurnVO existing = turn("turn-existing", TurnStatusEnum.SUCCEEDED, "deepseek", "deepseek-flash");
        MessageVO userMessage = message(
                "message-existing", "turn-existing", MessageRoleEnum.USER, "Hello", 1L);

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(sessionRepository.querySessionForUpdate("session-1")).thenReturn(true);
        when(turnService.queryTurnByRequestId("session-1", "turn-request-existing"))
                .thenReturn(Optional.of(existing));
        when(messageService.queryUserMessage("turn-existing"))
                .thenReturn(Optional.of(userMessage));

        assertRequestConflict(new AddTurnDTO(
                "project-1", "session-1", "deepseek", "deepseek-flash",
                "Different prompt", "turn-request-existing", "user-1"));
        assertRequestConflict(new AddTurnDTO(
                "project-1", "session-1", "kimi", "deepseek-flash",
                "Hello", "turn-request-existing", "user-1"));
        assertRequestConflict(new AddTurnDTO(
                "project-1", "session-1", "deepseek", "deepseek-chat",
                "Hello", "turn-request-existing", "user-1"));

        verify(turnService, never()).addTurn(any(), any(), any(), any());
        verify(messageService, never()).addMessage(any(), any(), any(), any());
        verify(sessionRepository, never()).update(any());
        verify(conversationMetrics, never()).idempotencyReplay("turn");
    }

    @Test
    void shouldRejectTurnWhenSessionAlreadyHasActiveTurn() {
        stubExecuteInline();

        SessionEntity session = session("project-1", "session-1");
        when(sessionRepository.querySession("project-1", "session-1", "user-1")).thenReturn(Optional.of(session));
        when(sessionRepository.querySessionForUpdate("session-1")).thenReturn(true);
        when(turnService.queryActiveTurnCount("session-1")).thenReturn(1L);

        assertThatThrownBy(() ->
                sessionService.addStreamingTurn(new AddTurnDTO("project-1", "session-1", "kimi", "kimi-k3", "Hello", "turn-request-1", "user-1")))
                .isInstanceOf(SessionException.class)
                .satisfies(exception ->
                        assertThat(((SessionException) exception).getErrorCode()).isEqualTo(SessionErrorCode.BUSY));

        verify(turnService, never()).addTurn(any(), any(), any(), any());
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

        verify(conversationMetrics).turnTerminal("stopped");
        verify(sessionRepository, never()).update(any());
    }

    @Test
    void shouldCleanStoppingMarkerWhenPendingTurnIsStoppedBeforeExecution() {
        stubExecuteInline();

        String turnId = "turn-pending-stop";
        SessionEntity session = session("project-1", "session-1");
        TurnExecutionVO execution = execution(turnId, "session-1");
        TurnVO pending = turn(turnId, TurnStatusEnum.PENDING);
        TurnVO stopped = turn(turnId, TurnStatusEnum.STOPPED);

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurnExecution(turnId))
                .thenReturn(Optional.of(execution));
        when(turnService.queryTurn(turnId))
                .thenReturn(Optional.of(pending), Optional.of(pending), Optional.of(stopped));
        when(turnService.updateTurnStopped(
                eq(turnId), eq("session-1"), any(LocalDateTime.class)))
                .thenReturn(1);

        TurnStreamListener listener = mock(TurnStreamListener.class);
        Runnable unsubscribe = sessionService.watchTurn(
                new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                listener);

        sessionService.stopTurn(
                new StopTurnDTO("project-1", "session-1", turnId, "user-1"));

        @SuppressWarnings("unchecked")
        Set<String> stoppingTurns =
                (Set<String>) ReflectionTestUtils.getField(sessionService, "stoppingTurns");
        assertThat(stoppingTurns).isNotNull();
        assertThat(stoppingTurns).doesNotContain(turnId);

        verify(turnService).updateTurnStopped(
                eq(turnId), eq("session-1"), any(LocalDateTime.class));
        verify(conversationMetrics).turnTerminal("stopped");
        verifyNoInteractions(llmClient);

        unsubscribe.run();
    }

    @Test
    void shouldBuildLightweightTurnNavigationFromUserMessages() {
        SessionEntity session = session("project-1", "session-1");
        String longPrompt = "  Build\n\t" + "界".repeat(170) + "  ";

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(messageService.queryUserNavigationMessageList("session-1")).thenReturn(List.of(
                message("message-1", "turn-1", MessageRoleEnum.USER, "First prompt", 1L),
                message("message-2", "turn-2", MessageRoleEnum.USER, longPrompt, 3L)));

        List<TurnNavigationItemVO> result = sessionService.queryTurnNavigation(
                new QuerySessionTurnNavigationDTO("project-1", "session-1", "user-1"));

        assertThat(result)
                .extracting(
                        TurnNavigationItemVO::getTurnId,
                        TurnNavigationItemVO::getUserMessageId,
                        TurnNavigationItemVO::getUserMessageSequence)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("turn-1", "message-1", 1L),
                        org.assertj.core.groups.Tuple.tuple("turn-2", "message-2", 3L));
        assertThat(result.get(1).getPreview()).doesNotContain("\n", "\t");
        assertThat(result.get(1).getPreview().codePointCount(0, result.get(1).getPreview().length()))
                .isEqualTo(160);
        verifyNoInteractions(turnService);
    }

    @Test
    void shouldBuildBoundedMessageWindowAroundAnchor() {
        SessionEntity session = session("project-1", "session-1");
        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));

        MessageVO anchor = message(
                "message-101", "turn-51", MessageRoleEnum.USER, "anchor", 101L);
        when(messageService.queryMessage("session-1", 101L)).thenReturn(Optional.of(anchor));

        List<MessageVO> olderRows = java.util.stream.LongStream.rangeClosed(75, 100)
                .mapToObj(sequence -> message(
                        "message-" + sequence,
                        "turn-" + sequence,
                        MessageRoleEnum.USER,
                        "message-" + sequence,
                        sequence))
                .sorted((left, right) -> Long.compare(right.getSequence(), left.getSequence()))
                .toList();
        when(messageService.queryMessageBefore("session-1", 101L, 26)).thenReturn(olderRows);

        List<MessageVO> newerRows = java.util.stream.LongStream.rangeClosed(102, 126)
                .mapToObj(sequence -> message(
                        "message-" + sequence,
                        "turn-" + sequence,
                        MessageRoleEnum.ASSISTANT,
                        "message-" + sequence,
                        sequence))
                .toList();
        when(messageService.queryMessageAfter("session-1", 101L, 25)).thenReturn(newerRows);

        SessionMessageWindowVO result = sessionService.queryMessageWindow(
                new QuerySessionMessageWindowDTO("project-1", "session-1", 101L, "user-1"));

        assertThat(result.getMessages()).hasSize(50);
        assertThat(result.getMessages().getFirst().getSequence()).isEqualTo(76L);
        assertThat(result.getMessages().get(25).getSequence()).isEqualTo(101L);
        assertThat(result.getMessages().getLast().getSequence()).isEqualTo(125L);
        assertThat(result.isHasOlder()).isTrue();
        assertThat(result.isHasNewer()).isTrue();
        assertThat(result.getOlderCursor()).isEqualTo(76L);
        assertThat(result.getNewerCursor()).isEqualTo(125L);
    }

    @Test
    void shouldRejectMessageWindowWhenAnchorDoesNotExist() {
        SessionEntity session = session("project-1", "session-1");
        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(messageService.queryMessage("session-1", 999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                sessionService.queryMessageWindow(
                        new QuerySessionMessageWindowDTO(
                                "project-1", "session-1", 999L, "user-1")))
                .isInstanceOf(SessionException.class)
                .satisfies(exception ->
                        assertThat(((SessionException) exception).getErrorCode())
                                .isEqualTo(SessionErrorCode.NOT_FOUND));
    }

    @Test
    void shouldLoadOnlyLatestFiftyMessagesWhenQueryingSession() {
        SessionEntity session = session("project-1", "session-1");
        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurnListByIds(any())).thenReturn(List.of());

        List<MessageVO> rows = java.util.stream.LongStream.rangeClosed(1, 51)
                .mapToObj(sequence -> message(
                        "message-" + sequence,
                        "turn-" + sequence,
                        MessageRoleEnum.USER,
                        "message-" + sequence,
                        sequence))
                .sorted((left, right) -> Long.compare(right.getSequence(), left.getSequence()))
                .toList();
        when(messageService.queryMessageBefore("session-1", null, 51)).thenReturn(rows);

        var result = sessionService.querySession(
                new QuerySessionDTO("project-1", "session-1", "user-1"));

        assertThat(result.getMessages()).hasSize(50);
        assertThat(result.getMessages().getFirst().getSequence()).isEqualTo(2L);
        assertThat(result.getMessages().getLast().getSequence()).isEqualTo(51L);
        assertThat(result.isHasMoreMessages()).isTrue();
        assertThat(result.getNextBeforeSequence()).isEqualTo(2L);
        verify(messageService, never()).queryMessageList("session-1");
        verify(turnService, never()).queryTurnList("session-1");
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
    void shouldLimitSessionChangesToOneHundredMessages() {
        SessionEntity session = session("project-1", "session-1");
        TurnVO latest = turn("turn-latest", TurnStatusEnum.SUCCEEDED);
        List<MessageVO> changes = java.util.stream.LongStream.rangeClosed(1, 100)
                .mapToObj(sequence -> message(
                        "message-" + sequence,
                        "turn-" + sequence,
                        MessageRoleEnum.USER,
                        "message-" + sequence,
                        sequence))
                .toList();

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryLatestTurn("session-1")).thenReturn(Optional.of(latest));
        when(messageService.queryMessageAfter("session-1", 0L, 100)).thenReturn(changes);
        when(messageService.queryLatestMessageSequence("session-1")).thenReturn(150L);

        var result = sessionService.querySessionChanges(
                new QuerySessionChangesDTO("project-1", "session-1", 0L, "user-1"));

        assertThat(result.getMessages()).hasSize(100);
        assertThat(result.getLatestSequence()).isEqualTo(150L);
        verify(messageService).queryMessageAfter("session-1", 0L, 100);
    }

    @Test
    void shouldExecuteTurnWithItsOwnModelInsteadOfSessionDefault() throws Exception {
        stubExecuteWithoutResultInline();

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
        stubContext(
                "session-1",
                currentTurnId,
                List.of(message("m1", currentTurnId, MessageRoleEnum.USER, "Hello", 1L)),
                List.of(current));
        when(llmClient.modelMetadata("kimi", "kimi-k3")).thenReturn(new LlmModelMetadata(100_000L, 10_000L));
        when(turnService.updateTurnSucceeded(
                eq(currentTurnId),
                eq("session-1"),
                any(), any(), any(), any(), any(), any(LocalDateTime.class)))
                .thenReturn(1);

        AtomicReference<LlmRequest> capturedRequest = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        doAnswer(invocation -> {
            capturedRequest.set(invocation.getArgument(0));
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.complete(response("kimi", "kimi-k3", "Done")));
            done.countDown();
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync(currentTurnId);

        assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(capturedRequest.get()).isNotNull();
        assertThat(capturedRequest.get().provider()).isEqualTo("kimi");
        assertThat(capturedRequest.get().model()).isEqualTo("kimi-k3");
    }

    @Test
    void shouldIncludeStoppedPartialAndExcludeFailedTurnFromContext() throws Exception {
        stubExecuteWithoutResultInline();

        String currentTurnId = "turn-current";
        SessionEntity session = session("project-1", "session-1");
        TurnVO succeeded = turn("turn-succeeded", TurnStatusEnum.SUCCEEDED);
        TurnVO failed = turn("turn-failed", TurnStatusEnum.FAILED);
        TurnVO stopped = turn("turn-stopped", TurnStatusEnum.STOPPED);
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);

        when(turnService.queryTurnExecution(currentTurnId))
                .thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        stubContext(
                "session-1",
                currentTurnId,
                List.of(
                        message("m1", "turn-succeeded", MessageRoleEnum.USER, "success user", 1L),
                        message("m2", "turn-succeeded", MessageRoleEnum.ASSISTANT, "success assistant", 2L),
                        message("m3", "turn-failed", MessageRoleEnum.USER, "failed user", 3L),
                        message("m4", "turn-failed", MessageRoleEnum.ASSISTANT, "failed partial", 4L),
                        message("m5", "turn-stopped", MessageRoleEnum.USER, "stopped user", 5L),
                        message("m6", "turn-stopped", MessageRoleEnum.ASSISTANT, "stopped partial", 6L),
                        message("m7", currentTurnId, MessageRoleEnum.USER, "current user", 7L)),
                List.of(succeeded, failed, stopped, current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(1_000L, 100L));
        when(llmClient.estimateTokens(any(LlmRequest.class))).thenReturn(100L);
        when(turnService.updateTurnSucceeded(
                eq(currentTurnId),
                eq("session-1"),
                any(), any(), any(), any(), any(), any(LocalDateTime.class)))
                .thenReturn(1);

        AtomicReference<LlmRequest> capturedRequest = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        doAnswer(invocation -> {
            capturedRequest.set(invocation.getArgument(0));
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.complete(
                    response("deepseek", "deepseek-flash", "Done")));
            done.countDown();
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync(currentTurnId);

        assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(capturedRequest.get().messages())
                .extracting(LlmMessage::content)
                .containsExactly(
                        "success user",
                        "success assistant",
                        "stopped user",
                        "stopped partial",
                        "current user");
    }

    @Test
    void shouldTrimOlderTurnsUsingModelTokenBudget() throws Exception {
        stubExecuteWithoutResultInline();
        String currentTurnId = "turn-current";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);
        TurnVO recent = turn("turn-recent", TurnStatusEnum.SUCCEEDED);
        TurnVO oldest = turn("turn-oldest", TurnStatusEnum.SUCCEEDED);

        when(turnService.queryTurnExecution(currentTurnId))
                .thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        stubContext(
                "session-1",
                currentTurnId,
                List.of(
                        message("m1", "turn-oldest", MessageRoleEnum.USER, "old user", 1L),
                        message("m2", "turn-oldest", MessageRoleEnum.ASSISTANT, "old assistant", 2L),
                        message("m3", "turn-recent", MessageRoleEnum.USER, "recent user", 3L),
                        message("m4", "turn-recent", MessageRoleEnum.ASSISTANT, "recent assistant", 4L),
                        message("m5", currentTurnId, MessageRoleEnum.USER, "current user", 5L)),
                List.of(oldest, recent, current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(100L, 20L));
        when(llmClient.estimateTokens(any(LlmRequest.class))).thenAnswer(invocation -> {
            LlmRequest request = invocation.getArgument(0);
            return switch (request.messages().size()) {
                case 1 -> 30L;
                case 3 -> 70L;
                default -> 110L;
            };
        });
        when(turnService.updateTurnSucceeded(
                eq(currentTurnId),
                eq("session-1"),
                any(), any(), any(), any(), any(), any(LocalDateTime.class)))
                .thenReturn(1);

        AtomicReference<LlmRequest> capturedRequest = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        doAnswer(invocation -> {
            capturedRequest.set(invocation.getArgument(0));
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.complete(
                    response("deepseek", "deepseek-flash", "Done")));
            done.countDown();
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync(currentTurnId);

        assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(capturedRequest.get()).isNotNull();
        assertThat(capturedRequest.get().messages())
                .extracting(LlmMessage::content)
                .containsExactly("recent user", "recent assistant", "current user");
        verify(messageService, never()).queryMessageList("session-1");
        verify(turnService, never()).queryTurnList("session-1");
    }

    @Test
    void shouldBuildContextFromMultipleBoundedHistoryBatches() throws Exception {
        stubExecuteWithoutResultInline();

        String currentTurnId = "turn-current";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);
        List<MessageVO> messages = new java.util.ArrayList<>();
        List<TurnVO> turns = new java.util.ArrayList<>();

        long sequence = 1L;
        for (int index = 1; index <= 26; index++) {
            String turnId = "turn-" + index;
            turns.add(turn(turnId, TurnStatusEnum.SUCCEEDED));
            messages.add(message(
                    "m" + sequence, turnId, MessageRoleEnum.USER, "user-" + index, sequence++));
            messages.add(message(
                    "m" + sequence, turnId, MessageRoleEnum.ASSISTANT, "assistant-" + index, sequence++));
        }
        messages.add(message(
                "m" + sequence, currentTurnId, MessageRoleEnum.USER, "current user", sequence));
        turns.add(current);

        when(turnService.queryTurnExecution(currentTurnId))
                .thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        stubContext("session-1", currentTurnId, messages, turns);
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(1_000L, 100L));
        when(llmClient.estimateTokens(any(LlmRequest.class)))
                .thenAnswer(invocation -> (long) ((LlmRequest) invocation.getArgument(0)).messages().size());
        when(turnService.updateTurnSucceeded(
                eq(currentTurnId),
                eq("session-1"),
                any(), any(), any(), any(), any(), any(LocalDateTime.class)))
                .thenReturn(1);

        AtomicReference<LlmRequest> capturedRequest = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        doAnswer(invocation -> {
            capturedRequest.set(invocation.getArgument(0));
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.complete(
                    response("deepseek", "deepseek-flash", "Done")));
            done.countDown();
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync(currentTurnId);

        assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(capturedRequest.get().messages()).hasSize(53);
        assertThat(capturedRequest.get().messages().getFirst().content()).isEqualTo("user-1");
        assertThat(capturedRequest.get().messages().getLast().content()).isEqualTo("current user");
        verify(messageService).queryMessageBefore("session-1", 53L, 50);
        verify(messageService).queryMessageBefore("session-1", 3L, 50);
        verify(messageService, never()).queryMessageList("session-1");
        verify(turnService, never()).queryTurnList("session-1");
    }

    @Test
    void shouldFailTurnWhenModelContextMetadataIsUnavailable() throws Exception {
        stubExecuteWithoutResultInline();

        String currentTurnId = "turn-no-metadata";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);

        when(turnService.queryTurnExecution(currentTurnId))
                .thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        when(llmClient.modelMetadata("deepseek", "unknown-model"))
                .thenThrow(new IllegalArgumentException("Model context metadata not found"));
        current.getInvocation().setModel("unknown-model");
        when(turnService.queryTurn(currentTurnId)).thenReturn(Optional.of(current));

        CountDownLatch failed = new CountDownLatch(1);
        when(turnService.updateTurnFailed(
                eq(currentTurnId),
                eq("session-1"),
                eq("Model context metadata not found"),
                any(LocalDateTime.class)))
                .thenAnswer(invocation -> {
                    failed.countDown();
                    return 1;
                });

        sessionService.executeTurnAsync(currentTurnId);

        assertThat(failed.await(2, TimeUnit.SECONDS)).isTrue();
        verify(llmClient, never()).estimateTokens(any());
        verify(llmClient, never()).streamingChat(any(), any());
    }

    @Test
    void shouldRejectCurrentTurnWhenItExceedsModelContextBudget() throws Exception {
        stubExecuteWithoutResultInline();

        String currentTurnId = "turn-too-large";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);

        when(turnService.queryTurnExecution(currentTurnId))
                .thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        stubContext(
                "session-1",
                currentTurnId,
                List.of(message(
                        "m1", currentTurnId, MessageRoleEnum.USER, "oversized current message", 1L)),
                List.of(current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(100L, 20L));
        when(llmClient.estimateTokens(any(LlmRequest.class))).thenReturn(81L);
        when(turnService.queryTurn(currentTurnId)).thenReturn(Optional.of(current));

        CountDownLatch failed = new CountDownLatch(1);
        when(turnService.updateTurnFailed(
                eq(currentTurnId),
                eq("session-1"),
                any(),
                any(LocalDateTime.class)))
                .thenAnswer(invocation -> {
                    failed.countDown();
                    return 1;
                });

        sessionService.executeTurnAsync(currentTurnId);

        assertThat(failed.await(2, TimeUnit.SECONDS)).isTrue();
        verify(llmClient, never()).streamingChat(any(), any());
    }

    @Test
    void shouldPersistFailureAndPartialAssistantContent() throws Exception {
        stubExecuteWithoutResultInline();
        String currentTurnId = "turn-failed";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);
        RuntimeException providerFailure = new RuntimeException("provider down");

        when(turnService.queryTurnExecution(currentTurnId))
                .thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        stubContext(
                "session-1",
                currentTurnId,
                List.of(message("m1", currentTurnId, MessageRoleEnum.USER, "Hello", 1L)),
                List.of(current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash")).thenReturn(new LlmModelMetadata(100_000L, 10_000L));
        when(turnService.queryTurn(currentTurnId)).thenReturn(Optional.of(current));
        when(turnService.updateTurnFailed(
                eq(currentTurnId),
                eq("session-1"),
                eq("provider down"),
                any(LocalDateTime.class)))
                .thenReturn(1);

        CountDownLatch partialPersisted = new CountDownLatch(1);
        when(messageService.addMessage(
                "session-1",
                currentTurnId,
                MessageRoleEnum.ASSISTANT,
                "Partial answer"))
                .thenAnswer(invocation -> {
                    partialPersisted.countDown();
                    return message("m2", currentTurnId, MessageRoleEnum.ASSISTANT, "Partial answer", 2L);
                });

        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.delta("Partial "));
            consumer.accept(LlmStreamEvent.delta("answer"));
            throw providerFailure;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync(currentTurnId);

        assertThat(partialPersisted.await(2, TimeUnit.SECONDS)).isTrue();
        verify(turnService).updateTurnFailed(
                eq(currentTurnId),
                eq("session-1"),
                eq("provider down"),
                any(LocalDateTime.class));
        verify(messageService).addMessage(
                "session-1",
                currentTurnId,
                MessageRoleEnum.ASSISTANT,
                "Partial answer");
    }

    @Test
    void shouldFailTurnWhenStreamingResponseExceedsMessageBoundary() throws Exception {
        stubExecuteWithoutResultInline();

        String currentTurnId = "turn-too-large-response";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);

        when(turnService.queryTurnExecution(currentTurnId))
                .thenReturn(Optional.of(execution(currentTurnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        stubContext(
                "session-1",
                currentTurnId,
                List.of(message("m1", currentTurnId, MessageRoleEnum.USER, "Hello", 1L)),
                List.of(current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(100_000L, 10_000L));
        when(turnService.queryTurn(currentTurnId)).thenReturn(Optional.of(current));

        CountDownLatch failed = new CountDownLatch(1);
        when(turnService.updateTurnFailed(
                eq(currentTurnId),
                eq("session-1"),
                eq(SessionErrorCode.MESSAGE_TOO_LARGE.getMessage()),
                any(LocalDateTime.class)))
                .thenAnswer(invocation -> {
                    failed.countDown();
                    return 1;
                });

        String oversized = "x".repeat(MessageConstant.MAX_CONTENT_LENGTH + 1);
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.delta(oversized));
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync(currentTurnId);

        assertThat(failed.await(2, TimeUnit.SECONDS)).isTrue();
        verify(turnService).updateTurnFailed(
                eq(currentTurnId),
                eq("session-1"),
                eq(SessionErrorCode.MESSAGE_TOO_LARGE.getMessage()),
                any(LocalDateTime.class));
        verify(messageService, never()).addMessage(
                eq("session-1"),
                eq(currentTurnId),
                eq(MessageRoleEnum.ASSISTANT),
                any());
    }

    @Test
    void shouldLeaveInterruptedRuntimeTurnForShutdownRecovery() {
        String currentTurnId = "turn-shutdown";
        SessionEntity session = session("project-1", "session-1");
        TurnVO current = turn(currentTurnId, TurnStatusEnum.RUNNING);

        when(turnService.updatePendingTurn(eq(currentTurnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(current));
        stubContext(
                "session-1",
                currentTurnId,
                List.of(message("m1", currentTurnId, MessageRoleEnum.USER, "Hello", 1L)),
                List.of(current));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(100_000L, 10_000L));
        doAnswer(invocation -> {
            throw new RuntimeException("shutdown interrupt");
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        AtomicBoolean shuttingDown =
                (AtomicBoolean) ReflectionTestUtils.getField(sessionService, "shuttingDown");
        assertThat(shuttingDown).isNotNull();
        shuttingDown.set(true);

        ReflectionTestUtils.invokeMethod(
                sessionService, "executeTurnStreaming", currentTurnId, session, "turn-request-shutdown");

        verify(turnService, never()).updateTurnFailed(
                eq(currentTurnId), eq("session-1"), any(), any(LocalDateTime.class));

        @SuppressWarnings("unchecked")
        Set<String> shutdownRecoveryTurnIds =
                (Set<String>) ReflectionTestUtils.getField(sessionService, "shutdownRecoveryTurnIds");
        assertThat(shutdownRecoveryTurnIds).contains(currentTurnId);
    }

    @Test
    void shouldKeepTurnPendingWhenGlobalExecutionLimitIsFull() throws Exception {
        stubExecuteWithoutResultInline();
        ReflectionTestUtils.setField(sessionService, "maxConcurrentExecutions", 1);
        ReflectionTestUtils.setField(sessionService, "maxConcurrentExecutionsPerUser", 1);

        SessionEntity firstSession = session("project-1", "session-1");
        SessionEntity secondSession = session("project-2", "session-2");
        secondSession.setCreateBy("user-2");

        TurnVO first = turn("turn-1", TurnStatusEnum.RUNNING);
        when(turnService.queryTurnExecution("turn-1"))
                .thenReturn(Optional.of(execution("turn-1", "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(firstSession));
        when(turnService.updatePendingTurn(eq("turn-1"), any(LocalDateTime.class)))
                .thenReturn(Optional.of(first));
        stubContext(
                "session-1",
                "turn-1",
                List.of(message("m1", "turn-1", MessageRoleEnum.USER, "Hello", 1L)),
                List.of(first));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(100_000L, 10_000L));
        when(turnService.updateTurnSucceeded(
                eq("turn-1"), eq("session-1"),
                any(), any(), any(), any(), any(), any(LocalDateTime.class)))
                .thenReturn(1);

        when(turnService.queryTurnExecution("turn-2"))
                .thenReturn(Optional.of(execution("turn-2", "session-2")));
        when(sessionRepository.queryById("session-2")).thenReturn(Optional.of(secondSession));
        when(turnService.updatePendingTurn(eq("turn-2"), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            started.countDown();
            release.await(2, TimeUnit.SECONDS);
            consumer.accept(LlmStreamEvent.complete(
                    response("deepseek", "deepseek-flash", "Done")));
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync("turn-1");
        assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

        sessionService.executeTurnAsync("turn-2");
        verify(turnService, never()).updatePendingTurn(eq("turn-2"), any(LocalDateTime.class));

        release.countDown();
        awaitActiveExecutions(0);

        sessionService.executeTurnAsync("turn-2");
        verify(turnService, timeout(2000)).updatePendingTurn(eq("turn-2"), any(LocalDateTime.class));
    }

    @Test
    void shouldKeepTurnPendingWhenUserExecutionLimitIsFull() throws Exception {
        stubExecuteWithoutResultInline();
        ReflectionTestUtils.setField(sessionService, "maxConcurrentExecutions", 2);
        ReflectionTestUtils.setField(sessionService, "maxConcurrentExecutionsPerUser", 1);

        SessionEntity firstSession = session("project-1", "session-1");
        SessionEntity secondSession = session("project-2", "session-2");

        TurnVO first = turn("turn-1", TurnStatusEnum.RUNNING);
        when(turnService.queryTurnExecution("turn-1"))
                .thenReturn(Optional.of(execution("turn-1", "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(firstSession));
        when(turnService.updatePendingTurn(eq("turn-1"), any(LocalDateTime.class)))
                .thenReturn(Optional.of(first));
        stubContext(
                "session-1",
                "turn-1",
                List.of(message("m1", "turn-1", MessageRoleEnum.USER, "Hello", 1L)),
                List.of(first));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(100_000L, 10_000L));
        when(turnService.updateTurnSucceeded(
                eq("turn-1"), eq("session-1"),
                any(), any(), any(), any(), any(), any(LocalDateTime.class)))
                .thenReturn(1);

        when(turnService.queryTurnExecution("turn-2"))
                .thenReturn(Optional.of(execution("turn-2", "session-2")));
        when(sessionRepository.queryById("session-2")).thenReturn(Optional.of(secondSession));
        when(turnService.updatePendingTurn(eq("turn-2"), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            started.countDown();
            release.await(2, TimeUnit.SECONDS);
            consumer.accept(LlmStreamEvent.complete(
                    response("deepseek", "deepseek-flash", "Done")));
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync("turn-1");
        assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

        sessionService.executeTurnAsync("turn-2");
        verify(turnService, never()).updatePendingTurn(eq("turn-2"), any(LocalDateTime.class));

        release.countDown();
        awaitActiveExecutions(0);

        sessionService.executeTurnAsync("turn-2");
        verify(turnService, timeout(2000)).updatePendingTurn(eq("turn-2"), any(LocalDateTime.class));
    }

    @Test
    void shouldReplayStreamingSnapshotWhenWatchingActiveTurn() throws Exception {
        String turnId = "turn-1";
        SessionEntity session = session("project-1", "session-1");
        TurnVO running = turn(turnId, TurnStatusEnum.RUNNING);

        when(turnService.queryTurnExecution(turnId))
                .thenReturn(Optional.of(execution(turnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(turnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(running));
        stubContext(
                "session-1",
                turnId,
                List.of(message("m1", turnId, MessageRoleEnum.USER, "Hello", 1L)),
                List.of(running));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash")).thenReturn(new LlmModelMetadata(100_000L, 10_000L));

        CountDownLatch partialReady = new CountDownLatch(1);
        CountDownLatch finish = new CountDownLatch(1);
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.delta("Partial"));
            partialReady.countDown();
            finish.await(2, TimeUnit.SECONDS);
            consumer.accept(LlmStreamEvent.delta(" answer"));
            consumer.accept(LlmStreamEvent.complete(
                    response("deepseek", "deepseek-flash", "Partial answer")));
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync(turnId);
        assertThat(partialReady.await(2, TimeUnit.SECONDS)).isTrue();

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurn(turnId)).thenReturn(Optional.of(running));

        AtomicReference<String> snapshot = new AtomicReference<>();
        AtomicReference<String> delta = new AtomicReference<>();
        CountDownLatch snapshotDelivered = new CountDownLatch(1);
        TurnStreamListener listener = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
                snapshot.set(content);
                snapshotDelivered.countDown();
            }

            @Override
            public void onDelta(String content) {
                delta.set(content);
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
            }
        };

        Runnable unsubscribe = sessionService.watchTurn(
                new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                listener);

        verify(conversationMetrics).watcherConnected();
        assertThat(snapshotDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(snapshot.get()).isEqualTo("Partial");

        finish.countDown();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
        while (delta.get() == null && System.nanoTime() < deadline) {
            Thread.onSpinWait();
        }
        assertThat(delta.get()).isEqualTo(" answer");

        unsubscribe.run();
        unsubscribe.run();
        verify(conversationMetrics).watcherDisconnected();
    }

    @Test
    void shouldConvergeMultipleWatchersToStoppedWithoutStartingAnotherExecution() throws Exception {
        stubExecuteInline();

        String turnId = "turn-multi-tab";
        SessionEntity session = session("project-1", "session-1");
        TurnExecutionVO execution = execution(turnId, "session-1");
        TurnVO running = turn(turnId, TurnStatusEnum.RUNNING);
        TurnVO stopped = turn(turnId, TurnStatusEnum.STOPPED);

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurnExecution(turnId))
                .thenReturn(Optional.of(execution));
        when(turnService.queryTurn(turnId))
                .thenReturn(
                        Optional.of(running),
                        Optional.of(running),
                        Optional.of(running),
                        Optional.of(running),
                        Optional.of(stopped));
        when(turnService.updateTurnStopped(eq(turnId), eq("session-1"), any(LocalDateTime.class)))
                .thenReturn(1);

        AtomicInteger firstStopped = new AtomicInteger();
        AtomicInteger secondStopped = new AtomicInteger();
        CountDownLatch firstStoppedDelivered = new CountDownLatch(1);
        CountDownLatch secondStoppedDelivered = new CountDownLatch(1);

        TurnStreamListener first = stoppedListener(firstStopped, firstStoppedDelivered);
        TurnStreamListener second = stoppedListener(secondStopped, secondStoppedDelivered);

        Runnable unsubscribeFirst = sessionService.watchTurn(
                new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                first);
        Runnable unsubscribeSecond = sessionService.watchTurn(
                new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                second);

        TurnVO result = sessionService.stopTurn(
                new StopTurnDTO("project-1", "session-1", turnId, "user-1"));

        assertThat(result).isSameAs(stopped);
        assertThat(firstStoppedDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(secondStoppedDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(firstStopped.get()).isEqualTo(1);
        assertThat(secondStopped.get()).isEqualTo(1);

        verify(conversationMetrics, times(2)).watcherConnected();
        verify(conversationMetrics).turnTerminal("stopped");
        verify(turnService).updateTurnStopped(eq(turnId), eq("session-1"), any(LocalDateTime.class));
        verify(messageService, never()).addMessage(any(), any(), any(), any());
        verifyNoInteractions(llmClient);

        unsubscribeFirst.run();
        unsubscribeSecond.run();

        verify(conversationMetrics, times(2)).watcherDisconnected();
    }

    @Test
    void shouldPersistOnlyPreCutoverDeltaWhenStopRacesWithProviderDelta() throws Exception {
        stubExecuteInline();

        String turnId = "turn-stop-cutover";
        SessionEntity session = session("project-1", "session-1");
        TurnExecutionVO execution = execution(turnId, "session-1");
        TurnVO running = turn(turnId, TurnStatusEnum.RUNNING);
        TurnVO stopped = turn(turnId, TurnStatusEnum.STOPPED);

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurnExecution(turnId))
                .thenReturn(Optional.of(execution));
        when(turnService.queryTurn(turnId))
                .thenReturn(Optional.of(running), Optional.of(running), Optional.of(stopped));

        CountDownLatch stopUpdateEntered = new CountDownLatch(1);
        CountDownLatch releaseStopUpdate = new CountDownLatch(1);
        doAnswer(invocation -> {
            stopUpdateEntered.countDown();
            assertThat(releaseStopUpdate.await(2, TimeUnit.SECONDS)).isTrue();
            return 1;
        }).when(turnService).updateTurnStopped(
                eq(turnId), eq("session-1"), any(LocalDateTime.class));

        CountDownLatch firstDeltaDelivered = new CountDownLatch(1);
        CountDownLatch stoppedDelivered = new CountDownLatch(1);
        List<String> events = new CopyOnWriteArrayList<>();
        TurnStreamListener listener = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
            }

            @Override
            public void onDelta(String content) {
                events.add("delta:" + content);
                firstDeltaDelivered.countDown();
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
                events.add("stopped");
                stoppedDelivered.countDown();
            }
        };

        Runnable unsubscribe = sessionService.watchTurn(
                new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                listener);

        turnStreamRuntime.delta(turnId, "A");
        assertThat(firstDeltaDelivered.await(2, TimeUnit.SECONDS)).isTrue();

        AtomicReference<TurnVO> stopResult = new AtomicReference<>();
        AtomicReference<Throwable> stopFailure = new AtomicReference<>();
        Thread stopThread = new Thread(() -> {
            try {
                stopResult.set(sessionService.stopTurn(
                        new StopTurnDTO("project-1", "session-1", turnId, "user-1")));
            } catch (Throwable throwable) {
                stopFailure.set(throwable);
            }
        });

        try {
            stopThread.start();
            assertThat(stopUpdateEntered.await(2, TimeUnit.SECONDS)).isTrue();

            turnStreamRuntime.delta(turnId, "B");

            String cutoverSnapshot = turnStreamRuntime.snapshot(turnId);
            assertThat(cutoverSnapshot).isEqualTo("A");
            assertThat(events).doesNotContain("delta:B");

            releaseStopUpdate.countDown();
            stopThread.join(2_000);

            assertThat(stopThread.isAlive()).isFalse();
            assertThat(stopFailure.get()).isNull();
            assertThat(stopResult.get()).isSameAs(stopped);
            assertThat(stoppedDelivered.await(2, TimeUnit.SECONDS)).isTrue();

            verify(messageService).addMessage(
                    "session-1", turnId, MessageRoleEnum.ASSISTANT, "A");
            assertThat(events).containsExactly("delta:A", "stopped");
        } finally {
            releaseStopUpdate.countDown();
            stopThread.join(2_000);
            unsubscribe.run();
        }
    }

    @Test
    void shouldResumeDeltaAfterStopCutoverRollsBack() throws Exception {
        stubExecuteInline();

        String turnId = "turn-stop-cutover-rollback";
        SessionEntity session = session("project-1", "session-1");
        TurnExecutionVO execution = execution(turnId, "session-1");
        TurnVO running = turn(turnId, TurnStatusEnum.RUNNING);

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurnExecution(turnId))
                .thenReturn(Optional.of(execution));
        when(turnService.queryTurn(turnId))
                .thenReturn(Optional.of(running), Optional.of(running));
        when(turnService.updateTurnStopped(
                eq(turnId), eq("session-1"), any(LocalDateTime.class)))
                .thenThrow(new IllegalStateException("stop persistence failed"));

        CountDownLatch deltasDelivered = new CountDownLatch(2);
        List<String> deltas = new CopyOnWriteArrayList<>();
        TurnStreamListener listener = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
            }

            @Override
            public void onDelta(String content) {
                deltas.add(content);
                deltasDelivered.countDown();
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
            }
        };

        Runnable unsubscribe = sessionService.watchTurn(
                new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                listener);

        turnStreamRuntime.delta(turnId, "A");

        assertThatThrownBy(() ->
                sessionService.stopTurn(
                        new StopTurnDTO("project-1", "session-1", turnId, "user-1")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("stop persistence failed");

        turnStreamRuntime.delta(turnId, "B");

        assertThat(deltasDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(deltas).containsExactly("A", "B");
        String snapshot = turnStreamRuntime.snapshot(turnId);
        assertThat(snapshot).isEqualTo("AB");

        unsubscribe.run();
    }

    @Test
    void shouldIsolateSlowWatcherFromOtherWatchersAndStop() throws Exception {
        stubExecuteInline();

        String turnId = "turn-slow-watcher";
        SessionEntity session = session("project-1", "session-1");
        TurnExecutionVO execution = execution(turnId, "session-1");
        TurnVO running = turn(turnId, TurnStatusEnum.RUNNING);
        TurnVO stopped = turn(turnId, TurnStatusEnum.STOPPED);

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurnExecution(turnId))
                .thenReturn(Optional.of(execution));
        when(turnService.queryTurn(turnId))
                .thenReturn(
                        Optional.of(running),
                        Optional.of(running),
                        Optional.of(running),
                        Optional.of(running),
                        Optional.of(stopped));
        when(turnService.updateTurnStopped(eq(turnId), eq("session-1"), any(LocalDateTime.class)))
                .thenReturn(1);

        CountDownLatch slowDeltaEntered = new CountDownLatch(1);
        CountDownLatch releaseSlowWatcher = new CountDownLatch(1);
        CountDownLatch slowStoppedDelivered = new CountDownLatch(1);
        CountDownLatch fastDeltaDelivered = new CountDownLatch(1);
        CountDownLatch fastStoppedDelivered = new CountDownLatch(1);

        TurnStreamListener slow = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
            }

            @Override
            public void onDelta(String content) {
                slowDeltaEntered.countDown();
                try {
                    releaseSlowWatcher.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
                slowStoppedDelivered.countDown();
            }
        };

        TurnStreamListener fast = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
            }

            @Override
            public void onDelta(String content) {
                fastDeltaDelivered.countDown();
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
                fastStoppedDelivered.countDown();
            }
        };

        Runnable unsubscribeSlow = sessionService.watchTurn(
                new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                slow);
        Runnable unsubscribeFast = sessionService.watchTurn(
                new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                fast);

        Thread deltaThread = new Thread(() ->
                turnStreamRuntime.delta(turnId, "Partial"));
        AtomicReference<TurnVO> stopResult = new AtomicReference<>();
        AtomicReference<Throwable> stopFailure = new AtomicReference<>();
        Thread stopThread = new Thread(() -> {
            try {
                stopResult.set(sessionService.stopTurn(
                        new StopTurnDTO("project-1", "session-1", turnId, "user-1")));
            } catch (Throwable throwable) {
                stopFailure.set(throwable);
            }
        });

        try {
            deltaThread.start();

            assertThat(slowDeltaEntered.await(2, TimeUnit.SECONDS)).isTrue();
            deltaThread.join(500);
            assertThat(deltaThread.isAlive()).isFalse();
            assertThat(fastDeltaDelivered.await(2, TimeUnit.SECONDS)).isTrue();

            stopThread.start();
            stopThread.join(500);

            assertThat(stopThread.isAlive()).isFalse();
            assertThat(stopFailure.get()).isNull();
            assertThat(stopResult.get()).isSameAs(stopped);
            assertThat(fastStoppedDelivered.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(slowStoppedDelivered.getCount()).isEqualTo(1L);

            verify(turnService).updateTurnStopped(eq(turnId), eq("session-1"), any(LocalDateTime.class));
            verify(messageService).addMessage(
                    "session-1", turnId, MessageRoleEnum.ASSISTANT, "Partial");
            verifyNoInteractions(llmClient);
        } finally {
            releaseSlowWatcher.countDown();
            deltaThread.join(2_000);
            stopThread.join(2_000);
        }

        assertThat(slowStoppedDelivered.await(2, TimeUnit.SECONDS)).isTrue();

        unsubscribeSlow.run();
        unsubscribeFast.run();
    }

    @Test
    void shouldDeliverSnapshotBeforeConcurrentFutureEvents() throws Exception {
        stubExecuteWithoutResultInline();

        String turnId = "turn-race";
        SessionEntity session = session("project-1", "session-1");
        TurnVO running = turn(turnId, TurnStatusEnum.RUNNING);

        when(turnService.queryTurnExecution(turnId))
                .thenReturn(Optional.of(execution(turnId, "session-1")));
        when(sessionRepository.queryById("session-1")).thenReturn(Optional.of(session));
        when(turnService.updatePendingTurn(eq(turnId), any(LocalDateTime.class)))
                .thenReturn(Optional.of(running));
        stubContext(
                "session-1",
                turnId,
                List.of(message("m-race", turnId, MessageRoleEnum.USER, "Hello", 1L)),
                List.of(running));
        when(llmClient.modelMetadata("deepseek", "deepseek-flash"))
                .thenReturn(new LlmModelMetadata(100_000L, 10_000L));
        when(turnService.updateTurnSucceeded(
                eq(turnId), eq("session-1"),
                any(), any(), any(), any(), any(), any(LocalDateTime.class)))
                .thenReturn(1);

        CountDownLatch partialReady = new CountDownLatch(1);
        CountDownLatch releaseFutureEvents = new CountDownLatch(1);
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<LlmStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(LlmStreamEvent.delta("Partial"));
            partialReady.countDown();
            releaseFutureEvents.await(2, TimeUnit.SECONDS);
            consumer.accept(LlmStreamEvent.delta(" answer"));
            consumer.accept(LlmStreamEvent.complete(
                    response("deepseek", "deepseek-flash", "Partial answer")));
            return null;
        }).when(llmClient).streamingChat(any(LlmRequest.class), any());

        sessionService.executeTurnAsync(turnId);
        assertThat(partialReady.await(2, TimeUnit.SECONDS)).isTrue();

        when(sessionRepository.querySession("project-1", "session-1", "user-1"))
                .thenReturn(Optional.of(session));
        when(turnService.queryTurn(turnId)).thenReturn(Optional.of(running));

        CountDownLatch snapshotEntered = new CountDownLatch(1);
        CountDownLatch releaseSnapshot = new CountDownLatch(1);
        CountDownLatch deltaDelivered = new CountDownLatch(1);
        CountDownLatch terminalDelivered = new CountDownLatch(1);
        List<String> events = new CopyOnWriteArrayList<>();
        AtomicReference<Runnable> unsubscribe = new AtomicReference<>();
        AtomicReference<Throwable> watchFailure = new AtomicReference<>();

        TurnStreamListener listener = new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
                snapshotEntered.countDown();
                try {
                    releaseSnapshot.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
                events.add("snapshot:" + content);
            }

            @Override
            public void onDelta(String content) {
                events.add("delta:" + content);
                deltaDelivered.countDown();
            }

            @Override
            public void onComplete() {
                events.add("complete");
                terminalDelivered.countDown();
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
            }
        };

        Thread watcherThread = new Thread(() -> {
            try {
                unsubscribe.set(sessionService.watchTurn(
                        new WatchTurnDTO("project-1", "session-1", turnId, "user-1"),
                        listener));
            } catch (Throwable throwable) {
                watchFailure.set(throwable);
            }
        });
        watcherThread.start();

        assertThat(snapshotEntered.await(2, TimeUnit.SECONDS)).isTrue();

        releaseFutureEvents.countDown();

        assertThat(deltaDelivered.await(200, TimeUnit.MILLISECONDS)).isFalse();
        assertThat(terminalDelivered.await(200, TimeUnit.MILLISECONDS)).isFalse();

        releaseSnapshot.countDown();

        watcherThread.join(2_000);
        assertThat(watchFailure.get()).isNull();
        assertThat(deltaDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(terminalDelivered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(events).containsExactly(
                "snapshot:Partial",
                "delta: answer",
                "complete");

        Runnable cleanup = unsubscribe.get();
        assertThat(cleanup).isNotNull();
        cleanup.run();
    }

    private static TurnStreamListener stoppedListener(
            AtomicInteger stoppedCount, CountDownLatch stoppedDelivered) {
        return new TurnStreamListener() {
            @Override
            public void onSnapshot(String content) {
            }

            @Override
            public void onDelta(String content) {
            }

            @Override
            public void onComplete() {
            }

            @Override
            public void onError(String message) {
            }

            @Override
            public void onStopped() {
                stoppedCount.incrementAndGet();
                stoppedDelivered.countDown();
            }
        };
    }

    private void assertRequestConflict(AddTurnDTO dto) {
        assertThatThrownBy(() -> sessionService.addStreamingTurn(dto))
                .isInstanceOf(SessionException.class)
                .satisfies(exception ->
                        assertThat(((SessionException) exception).getErrorCode())
                                .isEqualTo(SessionErrorCode.REQUEST_CONFLICT));
    }

    private void stubContext(
            String sessionId, String currentTurnId, List<MessageVO> messages, List<TurnVO> turns) {
        MessageVO currentUser = messages.stream()
                .filter(message -> currentTurnId.equals(message.getTurnId()))
                .filter(message -> MessageRoleEnum.USER.name().equals(message.getRole()))
                .findFirst()
                .orElseThrow();
        when(messageService.queryUserMessage(currentTurnId)).thenReturn(Optional.of(currentUser));

        boolean hasHistory = messages.stream()
                .anyMatch(message -> message.getSequence() < currentUser.getSequence());
        if (!hasHistory) {
            return;
        }

        when(messageService.queryMessageBefore(eq(sessionId), anyLong(), eq(50)))
                .thenAnswer(invocation -> {
                    long beforeSequence = invocation.getArgument(1);
                    return messages.stream()
                            .filter(message -> message.getSequence() < beforeSequence)
                            .sorted(Comparator.comparing(MessageVO::getSequence).reversed())
                            .limit(50)
                            .toList();
                });
        when(messageService.queryMessageListByTurnIds(any())).thenAnswer(invocation -> {
            List<String> turnIds = invocation.getArgument(0);
            return messages.stream()
                    .filter(message -> turnIds.contains(message.getTurnId()))
                    .sorted(Comparator.comparing(MessageVO::getSequence))
                    .toList();
        });
        when(turnService.queryTurnListByIds(any())).thenAnswer(invocation -> {
            List<String> turnIds = invocation.getArgument(0);
            return turns.stream()
                    .filter(turn -> turnIds.contains(turn.getId()))
                    .toList();
        });
    }

    private void awaitActiveExecutions(int expected) {
        AtomicInteger active = (AtomicInteger) ReflectionTestUtils.getField(sessionService, "activeExecutions");
        assertThat(active).isNotNull();

        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
        while (active.get() != expected && System.nanoTime() < deadline) {
            Thread.onSpinWait();
        }
        assertThat(active.get()).isEqualTo(expected);
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

    private static LlmResponse response(String provider, String model, String content) {
        return new LlmResponse(
                provider,
                model,
                content,
                new LlmUsage(10L, 5L, 15L),
                "request-1",
                "stop");
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
