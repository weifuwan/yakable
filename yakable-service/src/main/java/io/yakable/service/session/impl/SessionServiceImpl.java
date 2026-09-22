package io.yakable.service.session.impl;

import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.StopTurnDTO;
import io.yakable.common.bean.dto.session.QuerySessionChangesDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.dto.session.WatchTurnDTO;
import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.bean.vo.session.SessionChangesVO;
import io.yakable.common.bean.vo.session.SessionDetailVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.SessionModelVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnInvocationVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.exception.SessionException;
import io.yakable.common.utils.ConverUtils;
import io.yakable.common.utils.DateUtils;
import io.yakable.common.utils.StringUtils;
import io.yakable.common.utils.ThreadUtils;
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
import io.yakable.service.session.SessionService;
import io.yakable.service.session.TurnStreamListener;
import io.yakable.service.turn.TurnService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Service
@Validated
public class SessionServiceImpl implements SessionService {

    private static final String SYSTEM_PROMPT = "You are Yakable, a concise and accurate assistant.";
    private static final String TURN_RECOVERY_TASK = "turn-recovery";
    private static final String TURN_TASK_PREFIX = "turn-";
    private static final int RECOVERY_BATCH_SIZE = 100;
    private static final int INITIAL_MESSAGE_PAGE_SIZE = 50;
    private static final int DEFAULT_MAX_CONCURRENT_EXECUTIONS = 16;
    private static final int DEFAULT_MAX_CONCURRENT_EXECUTIONS_PER_USER = 2;

    private final Map<String, TurnStreamState> streamStates = new ConcurrentHashMap<>();
    private final Set<String> stoppingTurns = ConcurrentHashMap.newKeySet();
    private final AtomicInteger activeExecutions = new AtomicInteger();
    private final Map<String, Integer> activeExecutionsByUser = new ConcurrentHashMap<>();

    @Resource
    private SessionRepository sessionRepository;

    @Resource
    private TurnService turnService;

    @Resource
    private MessageService messageService;

    @Resource
    private LlmClient llmClient;

    @Resource
    private TransactionTemplate transactionTemplate;

    @Value("${yakable.turn-execution.recovery-interval:5s}")
    private Duration recoveryInterval;

    @Value("${yakable.turn-execution.running-timeout:10m}")
    private Duration runningTimeout;

    @Value("${yakable.turn-execution.max-concurrent:16}")
    private int maxConcurrentExecutions = DEFAULT_MAX_CONCURRENT_EXECUTIONS;

    @Value("${yakable.turn-execution.max-concurrent-per-user:2}")
    private int maxConcurrentExecutionsPerUser = DEFAULT_MAX_CONCURRENT_EXECUTIONS_PER_USER;

    @PostConstruct
    void startTurnRecovery() {
        validateExecutionLimits();
        ThreadUtils.scheduleWithFixedDelay(TURN_RECOVERY_TASK, this::recoverTurns, recoveryInterval);
    }

    @PreDestroy
    void stopTurnRecovery() {
        ThreadUtils.cancelScheduled(TURN_RECOVERY_TASK);
    }

    @Override
    public SessionInitVO addSession(AddSessionDTO dto) {
        SessionEntity session = ConverUtils.convert(dto, SessionEntity.class);
        session.initCreate(dto.userId());
        session.setActivityTime(session.getCreateTime());
        sessionRepository.add(session);

        TurnStartVO turn = addPendingTurn(
                session, dto.provider(), dto.model(), dto.content(), dto.requestId());

        SessionInitVO result = new SessionInitVO();
        result.setSessionId(session.getId());
        result.setUpdatedAt(session.getActivityTime());
        result.setTurnId(turn.getTurn().getId());
        return result;
    }

    @Override
    public TurnStartVO addTurn(AddTurnDTO dto) {
        TurnStartVO result = createTurn(dto);
        executeTurnAsync(result.getTurn().getId());
        return result;
    }

    @Override
    public TurnStartVO addStreamingTurn(AddTurnDTO dto) {
        return createTurn(dto);
    }

    @Override
    public TurnVO stopTurn(StopTurnDTO dto) {
        queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());
        TurnExecutionVO execution = turnService.queryTurnExecution(dto.turnId())
                .filter(turn -> dto.sessionId().equals(turn.getSessionId()))
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));

        TurnStreamState streamState = streamStates.get(dto.turnId());
        if (streamState != null) {
            stoppingTurns.add(dto.turnId());
        }

        int updated;
        try {
            String partialContent = streamState == null ? "" : streamState.snapshot();
            updated = transactionTemplate.execute(status -> {
                int stopped = turnService.updateTurnStopped(execution.getId(), dto.sessionId(), DateUtils.now());
                if (stopped == 1 && !StringUtils.isBlank(partialContent)) {
                    messageService.addMessage(
                            dto.sessionId(), dto.turnId(), MessageRoleEnum.ASSISTANT, partialContent);
                }
                return stopped;
            });
        } catch (RuntimeException exception) {
            stoppingTurns.remove(dto.turnId());
            throw exception;
        }

        if (updated == 1) {
            if (streamState != null) {
                streamState.stopped();
            }
            ThreadUtils.cancel(TURN_TASK_PREFIX + dto.turnId());
        } else {
            stoppingTurns.remove(dto.turnId());
        }
        return turnService.queryTurn(dto.turnId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
    }

    @Override
    public void executeTurnAsync(String turnId) {
        if (activeExecutions.get() >= maxConcurrentExecutions) {
            return;
        }

        TurnExecutionVO execution = turnService.queryTurnExecution(turnId).orElse(null);
        if (execution == null) {
            return;
        }

        SessionEntity session = sessionRepository.queryById(execution.getSessionId()).orElse(null);
        if (session == null || !tryAcquireExecutionSlot(session.getCreateBy())) {
            return;
        }

        boolean submitted = ThreadUtils.execute(TURN_TASK_PREFIX + turnId, () -> {
            try {
                executeTurnStreaming(turnId, session);
            } finally {
                releaseExecutionSlot(session.getCreateBy());
            }
        });
        if (!submitted) {
            releaseExecutionSlot(session.getCreateBy());
        }
    }

    @Override
    public Runnable watchTurn(WatchTurnDTO dto, TurnStreamListener listener) {
        queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());
        TurnExecutionVO execution = turnService.queryTurnExecution(dto.turnId())
                .filter(turn -> dto.sessionId().equals(turn.getSessionId()))
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));

        TurnVO turn = turnService.queryTurn(execution.getId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
        if (notifyTerminalTurn(turn, listener)) {
            return () -> {
            };
        }

        TurnStreamState state = streamStates.computeIfAbsent(dto.turnId(), ignored -> new TurnStreamState());
        state.add(listener);

        TurnVO latest = turnService.queryTurn(dto.turnId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
        if (notifyTerminalTurn(latest, state)) {
            removeStreamStateIfFinished(dto.turnId(), state);
        }

        return () -> {
            state.remove(listener);
            removeStreamStateIfFinished(dto.turnId(), state);
        };
    }

    @Override
    public SessionDetailVO querySession(QuerySessionDTO dto) {
        SessionEntity session = queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());

        List<MessageVO> rows =
                messageService.queryMessageBefore(dto.sessionId(), null, INITIAL_MESSAGE_PAGE_SIZE + 1);
        boolean hasMore = rows.size() > INITIAL_MESSAGE_PAGE_SIZE;
        List<MessageVO> pageRows = hasMore ? rows.subList(0, INITIAL_MESSAGE_PAGE_SIZE) : rows;
        List<MessageVO> messages = new ArrayList<>(pageRows);
        Collections.reverse(messages);

        SessionDetailVO result = new SessionDetailVO();
        result.setSession(toSessionVO(session));
        result.setTurns(turnService.queryTurnList(dto.sessionId()));
        result.setMessages(messages);
        result.setNextBeforeSequence(hasMore && !messages.isEmpty() ? messages.get(0).getSequence() : null);
        result.setHasMoreMessages(hasMore);
        return result;
    }

    @Override
    public Optional<SessionVO> queryLatestSession(String projectId) {
        return sessionRepository.queryLatestSession(projectId).map(SessionServiceImpl::toSessionVO);
    }

    @Override
    public SessionChangesVO querySessionChanges(QuerySessionChangesDTO dto) {
        queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());

        TurnVO latest = turnService.queryLatestTurn(dto.sessionId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));

        SessionChangesVO result = new SessionChangesVO();
        result.setLatestTurn(latest);
        result.setMessages(messageService.queryMessageAfter(dto.sessionId(), dto.afterSequence()));
        result.setLatestSequence(messageService.queryLatestMessageSequence(dto.sessionId()));
        return result;
    }

    @Override
    public SessionMessagePageVO querySessionMessage(QuerySessionMessagesDTO dto) {
        queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());

        List<MessageVO> rows = messageService.queryMessageBefore(dto.sessionId(), dto.beforeSequence(), dto.limit() + 1);
        boolean hasMore = rows.size() > dto.limit();
        List<MessageVO> pageRows = hasMore ? rows.subList(0, dto.limit()) : rows;

        List<MessageVO> messages = new ArrayList<>(pageRows);
        Collections.reverse(messages);

        SessionMessagePageVO result = new SessionMessagePageVO();
        result.setMessages(messages);
        result.setNextBeforeSequence(hasMore && !messages.isEmpty() ? messages.get(0).getSequence() : null);
        result.setHasMore(hasMore);
        return result;
    }

    private TurnStartVO createTurn(AddTurnDTO dto) {
        return transactionTemplate.execute(status -> {
            SessionEntity session = queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());
            return addPendingTurn(
                    session, dto.provider(), dto.model(), dto.content(), dto.requestId());
        });
    }

    private TurnStartVO addPendingTurn(
            SessionEntity session, String provider, String model, String content, String requestId) {
        if (!sessionRepository.querySessionForUpdate(session.getId())) {
            throw new SessionException(SessionErrorCode.NOT_FOUND);
        }

        TurnVO existing = turnService.queryTurnByRequestId(session.getId(), requestId).orElse(null);
        if (existing != null) {
            return existingTurnStart(existing);
        }
        if (turnService.queryActiveTurnCount(session.getId()) > 0) {
            throw new SessionException(SessionErrorCode.BUSY);
        }

        TurnVO turn = turnService.addTurn(session.getId(), provider, model, requestId);
        MessageVO message = messageService.addMessage(session.getId(), turn.getId(), MessageRoleEnum.USER, content);

        session.setProvider(provider);
        session.setModel(model);
        session.setActivityTime(message.getCreatedAt());
        session.initUpdate();
        sessionRepository.update(session);

        TurnStartVO result = new TurnStartVO();
        result.setTurn(turn);
        result.setUserMessage(message);
        return result;
    }

    private TurnStartVO existingTurnStart(TurnVO turn) {
        MessageVO message = messageService.queryUserMessage(turn.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "USER Message not found for Turn: " + turn.getId()));
        TurnStartVO result = new TurnStartVO();
        result.setTurn(turn);
        result.setUserMessage(message);
        return result;
    }

    private void executeTurnStreaming(String turnId, SessionEntity session) {
        TurnVO running = turnService.updatePendingTurn(turnId, DateUtils.now()).orElse(null);
        if (running == null) {
            TurnVO current = turnService.queryTurn(turnId).orElse(null);
            TurnStreamState existing = streamStates.get(turnId);
            if (current != null && existing != null) {
                notifyTerminalTurn(current, existing);
                removeStreamStateIfFinished(turnId, existing);
            }
            return;
        }

        TurnStreamState state = streamStates.computeIfAbsent(turnId, ignored -> new TurnStreamState());
        boolean[] completed = {false};

        try {
            llmClient.streamingChat(request(session, running), event -> {
                if (stoppingTurns.contains(turnId)) {
                    return;
                }
                if (event.type() == LlmStreamEvent.Type.DELTA) {
                    state.delta(event.delta());
                    return;
                }
                if (event.type() == LlmStreamEvent.Type.COMPLETE) {
                    persistSuccess(session.getId(), running, event.response());
                    completed[0] = true;
                    state.complete();
                }
            });

            if (!completed[0] && !isStopped(turnId)) {
                throw new IllegalStateException("Streaming turn ended before completion");
            }
        } catch (RuntimeException exception) {
            if (isStopped(turnId)) {
                state.stopped();
                return;
            }
            String partialContent = state.snapshot();
            persistFailure(session.getId(), running, partialContent, exception);
            state.failed(failureMessage(exception));
            throw exception;
        } finally {
            stoppingTurns.remove(turnId);
            removeStreamStateIfFinished(turnId, state);
        }
    }

    private LlmRequest request(SessionEntity session, TurnVO running) {
        TurnInvocationVO invocation = running.getInvocation();
        return llmRequest(
                invocation.getProvider(),
                invocation.getModel(),
                buildContext(session, running));
    }

    private List<LlmMessage> buildContext(SessionEntity session, TurnVO running) {
        String currentTurnId = running.getId();
        List<MessageVO> messages = messageService.queryMessageList(session.getId());
        Map<String, List<MessageVO>> messagesByTurn = messages.stream()
                .collect(Collectors.groupingBy(MessageVO::getTurnId));
        List<TurnVO> turns = turnService.queryTurnList(session.getId());

        TurnInvocationVO invocation = running.getInvocation();
        LlmModelMetadata metadata = llmClient.modelMetadata(invocation.getProvider(), invocation.getModel());
        return buildTokenBudgetContext(
                invocation.getProvider(), invocation.getModel(),
                messages, messagesByTurn, turns, currentTurnId, metadata);
    }

    private List<LlmMessage> buildTokenBudgetContext(
            String provider, String model,
            List<MessageVO> messages, Map<String, List<MessageVO>> messagesByTurn,
            List<TurnVO> turns, String currentTurnId, LlmModelMetadata metadata) {
        Set<String> selectedTurnIds = new HashSet<>();
        selectedTurnIds.add(currentTurnId);

        List<LlmMessage> context = contextMessages(messages, selectedTurnIds);
        long inputBudget = metadata.inputBudgetTokens();
        if (llmClient.estimateTokens(llmRequest(provider, model, context)) > inputBudget) {
            throw new SessionException(SessionErrorCode.CONTEXT_TOO_LARGE);
        }

        for (int index = turns.size() - 1; index >= 0; index--) {
            TurnVO turn = turns.get(index);
            if (currentTurnId.equals(turn.getId()) || !isContextTurn(turn)
                    || !hasCompleteExchange(messagesByTurn.getOrDefault(turn.getId(), List.of()))) {
                continue;
            }

            selectedTurnIds.add(turn.getId());
            List<LlmMessage> candidate = contextMessages(messages, selectedTurnIds);
            if (llmClient.estimateTokens(llmRequest(provider, model, candidate)) > inputBudget) {
                selectedTurnIds.remove(turn.getId());
                break;
            }
            context = candidate;
        }
        return context;
    }

    private LlmRequest llmRequest(String provider, String model, List<LlmMessage> messages) {
        return new LlmRequest(provider, model, SYSTEM_PROMPT, messages);
    }

    private static List<LlmMessage> contextMessages(List<MessageVO> messages, Set<String> selectedTurnIds) {
        return messages.stream()
                .filter(message -> selectedTurnIds.contains(message.getTurnId()))
                .map(SessionServiceImpl::toLlmMessage)
                .toList();
    }

    private static boolean isContextTurn(TurnVO turn) {
        return TurnStatusEnum.SUCCEEDED.name().equals(turn.getStatus())
                || TurnStatusEnum.STOPPED.name().equals(turn.getStatus());
    }

    private static boolean hasCompleteExchange(List<MessageVO> messages) {
        boolean hasUser = false;
        boolean hasAssistant = false;
        for (MessageVO message : messages) {
            if (MessageRoleEnum.USER.name().equals(message.getRole())) {
                hasUser = true;
            } else if (MessageRoleEnum.ASSISTANT.name().equals(message.getRole())
                    && !StringUtils.isBlank(message.getContent())) {
                hasAssistant = true;
            }
        }
        return hasUser && hasAssistant;
    }

    private void persistSuccess(String sessionId, TurnVO running, LlmResponse response) {
        LocalDateTime completedAt = DateUtils.now();
        LlmUsage usage = response.usage();

        transactionTemplate.executeWithoutResult(status -> {
            int updated = turnService.updateTurnSucceeded(
                    running.getId(), sessionId,
                    usage.inputTokens(), usage.outputTokens(), usage.totalTokens(),
                    response.providerRequestId(), response.finishReason(), completedAt);
            if (updated != 1) {
                throw new IllegalStateException("Turn is no longer RUNNING: " + running.getId());
            }

            messageService.addMessage(sessionId, running.getId(), MessageRoleEnum.ASSISTANT, response.content());
        });
    }

    private void persistFailure(
            String sessionId, TurnVO running, String partialContent, RuntimeException originalFailure) {
        LocalDateTime failedAt = DateUtils.now();

        try {
            transactionTemplate.executeWithoutResult(status -> {
                int failed = turnService.updateTurnFailed(
                        running.getId(), sessionId, failureMessage(originalFailure), failedAt);
                if (failed == 1 && !StringUtils.isBlank(partialContent)) {
                    messageService.addMessage(
                            sessionId, running.getId(), MessageRoleEnum.ASSISTANT, partialContent);
                }
            });
        } catch (RuntimeException persistenceFailure) {
            originalFailure.addSuppressed(persistenceFailure);
        }
    }

    private boolean isStopped(String turnId) {
        return turnService.queryTurn(turnId)
                .map(turn -> TurnStatusEnum.STOPPED.name().equals(turn.getStatus()))
                .orElse(false);
    }

    private void recoverTurns() {
        turnService.updateStaleTurnPending(DateUtils.now().minus(runningTimeout));
        turnService.queryPendingTurnIdList(RECOVERY_BATCH_SIZE).forEach(this::executeTurnAsync);
    }

    private boolean tryAcquireExecutionSlot(String userId) {
        while (true) {
            int current = activeExecutions.get();
            if (current >= maxConcurrentExecutions) {
                return false;
            }
            if (activeExecutions.compareAndSet(current, current + 1)) {
                break;
            }
        }

        AtomicBoolean acquired = new AtomicBoolean();
        activeExecutionsByUser.compute(userId, (ignored, current) -> {
            int count = current == null ? 0 : current;
            if (count >= maxConcurrentExecutionsPerUser) {
                return current;
            }
            acquired.set(true);
            return count + 1;
        });
        if (acquired.get()) {
            return true;
        }

        activeExecutions.decrementAndGet();
        return false;
    }

    private void releaseExecutionSlot(String userId) {
        activeExecutionsByUser.computeIfPresent(
                userId, (ignored, current) -> current <= 1 ? null : current - 1);
        activeExecutions.decrementAndGet();
    }

    private void validateExecutionLimits() {
        if (maxConcurrentExecutions <= 0 || maxConcurrentExecutionsPerUser <= 0) {
            throw new IllegalStateException("Turn execution concurrency limits must be greater than zero");
        }
    }


    private static boolean notifyTerminalTurn(TurnVO turn, TurnStreamListener listener) {
        if (TurnStatusEnum.SUCCEEDED.name().equals(turn.getStatus())) {
            listener.onComplete();
            return true;
        }
        if (TurnStatusEnum.FAILED.name().equals(turn.getStatus())) {
            listener.onError(turn.getErrorMessage() == null ? "Turn failed." : turn.getErrorMessage());
            return true;
        }
        if (TurnStatusEnum.STOPPED.name().equals(turn.getStatus())) {
            listener.onStopped();
            return true;
        }
        return false;
    }

    private static boolean notifyTerminalTurn(TurnVO turn, TurnStreamState state) {
        if (TurnStatusEnum.SUCCEEDED.name().equals(turn.getStatus())) {
            state.complete();
            return true;
        }
        if (TurnStatusEnum.FAILED.name().equals(turn.getStatus())) {
            state.failed(turn.getErrorMessage() == null ? "Turn failed." : turn.getErrorMessage());
            return true;
        }
        if (TurnStatusEnum.STOPPED.name().equals(turn.getStatus())) {
            state.stopped();
            return true;
        }
        return false;
    }

    private void removeStreamStateIfFinished(String turnId, TurnStreamState state) {
        if (state.isTerminal() && state.isEmpty()) {
            streamStates.remove(turnId, state);
        }
    }

    private static final class TurnStreamState {

        private final StringBuffer content = new StringBuffer();
        private final List<TurnStreamListener> listeners = new CopyOnWriteArrayList<>();
        private final AtomicReference<TerminalEvent> terminal = new AtomicReference<>();

        void add(TurnStreamListener listener) {
            listeners.add(listener);
            String snapshot = snapshot();
            if (!snapshot.isBlank()) {
                safeNotify(listener, item -> item.onSnapshot(snapshot));
            }
            TerminalEvent current = terminal.get();
            if (current != null) {
                notifyTerminal(listener, current);
            }
        }

        void remove(TurnStreamListener listener) {
            listeners.remove(listener);
        }

        void delta(String value) {
            if (terminal.get() != null) {
                return;
            }
            synchronized (content) {
                content.append(value);
            }
            listeners.forEach(listener -> safeNotify(listener, item -> item.onDelta(value)));
        }

        String snapshot() {
            synchronized (content) {
                return content.toString();
            }
        }

        void complete() {
            publishTerminal(new TerminalEvent(TerminalType.COMPLETE, null));
        }

        void failed(String message) {
            publishTerminal(new TerminalEvent(TerminalType.FAILED, message));
        }

        void stopped() {
            publishTerminal(new TerminalEvent(TerminalType.STOPPED, null));
        }

        boolean isTerminal() {
            return terminal.get() != null;
        }

        boolean isEmpty() {
            return listeners.isEmpty();
        }

        private void publishTerminal(TerminalEvent event) {
            if (!terminal.compareAndSet(null, event)) {
                return;
            }
            listeners.forEach(listener -> notifyTerminal(listener, event));
        }

        private static void notifyTerminal(TurnStreamListener listener, TerminalEvent event) {
            switch (event.type()) {
                case COMPLETE -> safeNotify(listener, TurnStreamListener::onComplete);
                case FAILED -> safeNotify(listener, item -> item.onError(event.message()));
                case STOPPED -> safeNotify(listener, TurnStreamListener::onStopped);
            }
        }

        private static void safeNotify(
                TurnStreamListener listener, java.util.function.Consumer<TurnStreamListener> callback) {
            try {
                callback.accept(listener);
            } catch (RuntimeException ignored) {
                // 客户端连接异常不能影响 Turn 后台执行。
            }
        }
    }

    private record TerminalEvent(TerminalType type, String message) {
    }

    private enum TerminalType {
        COMPLETE,
        FAILED,
        STOPPED
    }

    private SessionEntity queryOwnedSession(String projectId, String sessionId, String userId) {
        return sessionRepository.querySession(projectId, sessionId, userId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
    }

    private static SessionVO toSessionVO(SessionEntity entity) {
        SessionVO result = ConverUtils.convert(entity, SessionVO.class);
        result.setModel(ConverUtils.convert(entity, SessionModelVO.class));
        result.setCreatedAt(entity.getCreateTime());
        result.setUpdatedAt(entity.getActivityTime());
        return result;
    }

    private static LlmMessage toLlmMessage(MessageVO message) {
        LlmMessage.Role role = MessageRoleEnum.USER.name().equals(message.getRole())
                ? LlmMessage.Role.USER
                : LlmMessage.Role.ASSISTANT;
        return new LlmMessage(role, message.getContent());
    }

    private static String failureMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message.strip();
    }
}
