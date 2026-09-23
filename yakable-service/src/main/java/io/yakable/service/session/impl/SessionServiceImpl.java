package io.yakable.service.session.impl;

import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.StopTurnDTO;
import io.yakable.common.bean.dto.session.QuerySessionChangesDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessageWindowDTO;
import io.yakable.common.bean.dto.session.QuerySessionTurnNavigationDTO;
import io.yakable.common.bean.dto.session.WatchTurnDTO;
import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.bean.vo.session.SessionChangesVO;
import io.yakable.common.bean.vo.session.SessionDetailVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.SessionMessageWindowVO;
import io.yakable.common.bean.vo.session.SessionModelVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnInvocationVO;
import io.yakable.common.bean.vo.session.TurnNavigationItemVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.enums.session.TurnTypeEnum;
import io.yakable.common.exception.SessionException;
import io.yakable.common.utils.ConverUtils;
import io.yakable.common.utils.DateUtils;
import io.yakable.common.utils.StringUtils;
import io.yakable.common.utils.ThreadUtils;
import io.yakable.core.conversation.stream.TurnStreamListener;
import io.yakable.core.conversation.stream.TurnStreamRuntime;
import io.yakable.core.llm.LlmClient;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmModelMetadata;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmStreamEvent;
import io.yakable.core.llm.LlmUsage;
import io.yakable.core.project.files.ProjectFiles;
import io.yakable.core.project.generation.ProjectCodeGenerationResult;
import io.yakable.core.project.generation.ProjectCodeGenerator;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.message.MessageService;
import io.yakable.service.observability.ConversationMetrics;
import io.yakable.service.session.SessionService;
import io.yakable.service.turn.TurnService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import io.micrometer.core.instrument.Timer;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Service
@Validated
public class SessionServiceImpl implements SessionService {

    private static final System.Logger log = System.getLogger(SessionServiceImpl.class.getName());
    private static final String SYSTEM_PROMPT = "You are Yakable, a concise and accurate assistant.";
    private static final String TURN_RECOVERY_TASK = "turn-recovery";
    private static final String TURN_TASK_PREFIX = "turn-";
    private static final String RECOVERED_GENERATION_SUMMARY = "Project generation completed.";
    private static final int RECOVERY_BATCH_SIZE = 100;
    private static final int INITIAL_MESSAGE_PAGE_SIZE = 50;
    private static final int SESSION_CHANGE_MESSAGE_LIMIT = 100;
    private static final int TURN_NAVIGATION_PREVIEW_MAX_CODE_POINTS = 160;
    private static final int TARGET_MESSAGE_WINDOW_SIZE = 50;
    private static final int TARGET_MESSAGE_WINDOW_BEFORE_SIZE = TARGET_MESSAGE_WINDOW_SIZE / 2;
    private static final int TARGET_MESSAGE_WINDOW_AFTER_SIZE =
            TARGET_MESSAGE_WINDOW_SIZE - TARGET_MESSAGE_WINDOW_BEFORE_SIZE - 1;
    private static final int CONTEXT_HISTORY_BATCH_SIZE = 50;
    private static final int DEFAULT_MAX_CONCURRENT_EXECUTIONS = 16;
    private static final int DEFAULT_MAX_CONCURRENT_EXECUTIONS_PER_USER = 2;

    private final Set<String> stoppingTurns = ConcurrentHashMap.newKeySet();
    private final Set<String> runningTurnIds = ConcurrentHashMap.newKeySet();
    private final Set<String> shutdownRecoveryTurnIds = ConcurrentHashMap.newKeySet();
    private final AtomicBoolean shuttingDown = new AtomicBoolean();
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
    private TurnStreamRuntime turnStreamRuntime;

    @Resource
    private ProjectCodeGenerator projectCodeGenerator;

    @Resource
    private ProjectFiles projectFiles;

    @Resource
    private TransactionTemplate transactionTemplate;

    @Resource
    private ConversationMetrics conversationMetrics;

    @Value("${yakable.turn-execution.recovery-interval:5s}")
    private Duration recoveryInterval;

    @Value("${yakable.turn-execution.running-timeout:10m}")
    private Duration runningTimeout;

    @Value("${yakable.turn-execution.max-concurrent:16}")
    private int maxConcurrentExecutions = DEFAULT_MAX_CONCURRENT_EXECUTIONS;

    @Value("${yakable.turn-execution.max-concurrent-per-user:2}")
    private int maxConcurrentExecutionsPerUser = DEFAULT_MAX_CONCURRENT_EXECUTIONS_PER_USER;

    @Value("${yakable.runtime.shutdown-timeout:30s}")
    private Duration shutdownTimeout;

    @PostConstruct
    void startTurnRecovery() {
        validateExecutionLimits();
        ThreadUtils.scheduleWithFixedDelay(TURN_RECOVERY_TASK, this::recoverTurns, recoveryInterval);
    }

    @PreDestroy
    void shutdownRuntime() {
        shuttingDown.set(true);
        ThreadUtils.cancelScheduled(TURN_RECOVERY_TASK);

        Set<String> turnsToRecover = new HashSet<>(runningTurnIds);
        ThreadUtils.shutdown(shutdownTimeout);
        turnsToRecover.addAll(runningTurnIds);
        turnsToRecover.addAll(shutdownRecoveryTurnIds);
        long recovered = turnsToRecover.stream()
                .mapToLong(turnService::updateRunningTurnPending)
                .sum();
        conversationMetrics.recovered("shutdown", recovered);
        if (recovered > 0) {
            log.log(System.Logger.Level.INFO, "Recovered shutdown Turns to PENDING count=" + recovered);
        }
    }

    @Override
    public SessionInitVO addSession(AddSessionDTO dto) {
        SessionEntity session = ConverUtils.convert(dto, SessionEntity.class);
        session.initCreate(dto.userId());
        session.setActivityTime(session.getCreateTime());
        sessionRepository.add(session);

        TurnStartVO turn = addPendingTurn(
                session, dto.turnType(), dto.provider(), dto.model(), dto.content(), dto.requestId());

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

        Optional<String> cutoverSnapshot = turnStreamRuntime.beginStopCutover(dto.turnId());
        if (cutoverSnapshot.isPresent()) {
            stoppingTurns.add(dto.turnId());
        }

        String partialContent = cutoverSnapshot.orElse("");
        int updated;
        try {
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
            if (cutoverSnapshot.isPresent()) {
                turnStreamRuntime.cancelStopCutover(dto.turnId());
            }
            throw exception;
        }

        if (updated == 1) {
            conversationMetrics.turnTerminal("stopped");
            log.log(
                    System.Logger.Level.INFO,
                    "Turn stopped userId=" + dto.userId()
                            + " projectId=" + dto.projectId()
                            + " sessionId=" + dto.sessionId()
                            + " turnId=" + dto.turnId()
                            + " requestId=" + execution.getRequestId());
            if (cutoverSnapshot.isPresent()) {
                turnStreamRuntime.stopped(dto.turnId());
            }
            stoppingTurns.remove(dto.turnId());
            ThreadUtils.cancel(TURN_TASK_PREFIX + dto.turnId());
        } else {
            stoppingTurns.remove(dto.turnId());
            if (cutoverSnapshot.isPresent()) {
                turnStreamRuntime.cancelStopCutover(dto.turnId());
            }
        }
        return turnService.queryTurn(dto.turnId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
    }

    @Override
    public void executeTurnAsync(String turnId) {
        if (shuttingDown.get()) {
            conversationMetrics.executionDeferred("shutdown");
            return;
        }
        if (activeExecutions.get() >= maxConcurrentExecutions) {
            conversationMetrics.executionDeferred("global_limit");
            return;
        }

        TurnExecutionVO execution = turnService.queryTurnExecution(turnId).orElse(null);
        if (execution == null) {
            return;
        }

        SessionEntity session = sessionRepository.queryById(execution.getSessionId()).orElse(null);
        if (session == null) {
            log.log(
                    System.Logger.Level.WARNING,
                    "Turn execution session missing sessionId=" + execution.getSessionId()
                            + " turnId=" + turnId
                            + " requestId=" + execution.getRequestId());
            return;
        }
        if (!tryAcquireExecutionSlot(session.getCreateBy())) {
            conversationMetrics.executionDeferred("capacity");
            return;
        }

        boolean submitted = ThreadUtils.execute(TURN_TASK_PREFIX + turnId, () -> {
            conversationMetrics.executionStarted();
            log.log(
                    System.Logger.Level.INFO,
                    "Turn execution started requestId=" + execution.getRequestId()
                            + " userId=" + session.getCreateBy()
                            + " projectId=" + session.getProjectId()
                            + " sessionId=" + session.getId()
                            + " turnId=" + turnId
                            + " provider=" + execution.getProvider()
                            + " model=" + execution.getModel());
            try {
                if (TurnTypeEnum.PROJECT_GENERATION == execution.getTurnType()) {
                    executeProjectGeneration(turnId, session, execution);
                } else {
                    executeTurnStreaming(turnId, session, execution.getRequestId());
                }
            } finally {
                conversationMetrics.executionFinished();
                releaseExecutionSlot(session.getCreateBy());
            }
        });
        if (!submitted) {
            conversationMetrics.executionDeferred("executor");
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

        Runnable runtimeUnsubscribe = turnStreamRuntime.watch(dto.turnId(), listener);
        conversationMetrics.watcherConnected();
        AtomicBoolean watcherClosed = new AtomicBoolean();

        TurnVO latest = turnService.queryTurn(dto.turnId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
        if (publishTerminalTurn(latest)) {
            turnStreamRuntime.cleanup(dto.turnId());
        }

        return () -> {
            if (!watcherClosed.compareAndSet(false, true)) {
                return;
            }
            runtimeUnsubscribe.run();
            conversationMetrics.watcherDisconnected();
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
        result.setTurns(turnService.queryTurnListByIds(turnIds(messages)));
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
        result.setMessages(messageService.queryMessageAfter(
                dto.sessionId(), dto.afterSequence(), SESSION_CHANGE_MESSAGE_LIMIT));
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

    @Override
    public List<TurnNavigationItemVO> queryTurnNavigation(QuerySessionTurnNavigationDTO dto) {
        queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());

        return messageService.queryUserNavigationMessageList(dto.sessionId()).stream()
                .map(SessionServiceImpl::toTurnNavigationItemVO)
                .toList();
    }

    @Override
    public SessionMessageWindowVO queryMessageWindow(QuerySessionMessageWindowDTO dto) {
        queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());

        MessageVO anchor = messageService.queryMessage(dto.sessionId(), dto.anchorSequence())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));

        List<MessageVO> olderRows = messageService.queryMessageBefore(
                dto.sessionId(), dto.anchorSequence(), TARGET_MESSAGE_WINDOW_BEFORE_SIZE + 1);
        boolean hasOlder = olderRows.size() > TARGET_MESSAGE_WINDOW_BEFORE_SIZE;
        List<MessageVO> older = new ArrayList<>(
                olderRows.subList(0, Math.min(olderRows.size(), TARGET_MESSAGE_WINDOW_BEFORE_SIZE)));
        Collections.reverse(older);

        List<MessageVO> newerRows = messageService.queryMessageAfter(
                dto.sessionId(), dto.anchorSequence(), TARGET_MESSAGE_WINDOW_AFTER_SIZE + 1);
        boolean hasNewer = newerRows.size() > TARGET_MESSAGE_WINDOW_AFTER_SIZE;
        List<MessageVO> newer = newerRows.subList(
                0, Math.min(newerRows.size(), TARGET_MESSAGE_WINDOW_AFTER_SIZE));

        List<MessageVO> messages = new ArrayList<>(TARGET_MESSAGE_WINDOW_SIZE);
        messages.addAll(older);
        messages.add(anchor);
        messages.addAll(newer);

        SessionMessageWindowVO result = new SessionMessageWindowVO();
        result.setMessages(messages);
        result.setHasOlder(hasOlder);
        result.setHasNewer(hasNewer);
        result.setOlderCursor(hasOlder ? messages.getFirst().getSequence() : null);
        result.setNewerCursor(hasNewer ? messages.getLast().getSequence() : null);
        return result;
    }

    private TurnStartVO createTurn(AddTurnDTO dto) {
        return transactionTemplate.execute(status -> {
            SessionEntity session = queryOwnedSession(dto.projectId(), dto.sessionId(), dto.userId());
            return addPendingTurn(
                    session, TurnTypeEnum.CHAT, dto.provider(), dto.model(), dto.content(), dto.requestId());
        });
    }

    private TurnStartVO addPendingTurn(
            SessionEntity session, TurnTypeEnum turnType, String provider, String model, String content, String requestId) {
        if (!sessionRepository.querySessionForUpdate(session.getId())) {
            throw new SessionException(SessionErrorCode.NOT_FOUND);
        }

        TurnVO existing = turnService.queryTurnByRequestId(session.getId(), requestId).orElse(null);
        if (existing != null) {
            TurnStartVO existingStart = existingTurnStart(existing);
            if (!sameTurnRequest(existingStart, provider, model, content)) {
                log.log(
                        System.Logger.Level.WARNING,
                        "Turn idempotency conflict requestId=" + requestId
                                + " userId=" + session.getCreateBy()
                                + " projectId=" + session.getProjectId()
                                + " sessionId=" + session.getId()
                                + " turnId=" + existing.getId());
                throw new SessionException(SessionErrorCode.REQUEST_CONFLICT);
            }
            conversationMetrics.idempotencyReplay("turn");
            log.log(
                    System.Logger.Level.INFO,
                    "Turn idempotency replay requestId=" + requestId
                            + " userId=" + session.getCreateBy()
                            + " projectId=" + session.getProjectId()
                            + " sessionId=" + session.getId()
                            + " turnId=" + existing.getId());
            return existingStart;
        }
        if (turnService.queryActiveTurnCount(session.getId()) > 0) {
            throw new SessionException(SessionErrorCode.BUSY);
        }

        TurnVO turn = turnService.addTurn(session.getId(), turnType, provider, model, requestId);
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

    private static boolean sameTurnRequest(
            TurnStartVO existing, String provider, String model, String content) {
        TurnInvocationVO invocation = existing.getTurn().getInvocation();
        return invocation != null
                && Objects.equals(provider, invocation.getProvider())
                && Objects.equals(model, invocation.getModel())
                && Objects.equals(content, existing.getUserMessage().getContent());
    }

    private void executeProjectGeneration(
            String turnId, SessionEntity session, TurnExecutionVO execution) {
        TurnVO running = turnService.updatePendingTurn(turnId, DateUtils.now()).orElse(null);
        if (running == null) {
            TurnVO current = turnService.queryTurn(turnId).orElse(null);
            if (current != null && publishTerminalTurn(current)) {
                turnStreamRuntime.cleanup(turnId);
            }
            return;
        }

        runningTurnIds.add(turnId);
        turnStreamRuntime.open(turnId);
        Timer.Sample llmSample = null;
        AtomicReference<String> llmOutcome = new AtomicReference<>("failure");

        try {
            if (projectFiles.isPublished(session.getProjectId(), turnId)) {
                if (completePublishedGeneration(session, running)) {
                    llmOutcome.set("recovered");
                    publishGenerationSucceeded(session, running, execution.getRequestId());
                }
                return;
            }

            MessageVO userMessage = messageService.queryUserMessage(turnId)
                    .orElseThrow(() -> new IllegalStateException(
                            "USER Message not found for Turn: " + turnId));

            llmSample = conversationMetrics.startLlmCall();
            ProjectCodeGenerationResult result = projectCodeGenerator.generate(
                    execution.getProvider(), execution.getModel(), userMessage.getContent());

            if (persistProjectGenerationSuccess(session, running, result)) {
                llmOutcome.set("success");
                publishGenerationSucceeded(session, running, execution.getRequestId());
                return;
            }

            TurnVO current = turnService.queryTurn(turnId).orElse(null);
            if (current != null) {
                publishTerminalTurn(current);
            }
        } catch (RuntimeException exception) {
            if (shuttingDown.get()) {
                llmOutcome.set("shutdown");
                shutdownRecoveryTurnIds.add(turnId);
                return;
            }
            if (isStopped(turnId)) {
                llmOutcome.set("stopped");
                turnStreamRuntime.stopped(turnId);
                return;
            }
            if (projectFiles.isPublished(session.getProjectId(), turnId)) {
                llmOutcome.set("published_recovery");
                int recovered = turnService.updateRunningTurnPending(turnId);
                conversationMetrics.recovered("project_publication", recovered);
                return;
            }

            boolean failed = persistFailure(session.getId(), running, "", exception);
            if (failed) {
                conversationMetrics.turnTerminal("failed");
                log.log(
                        System.Logger.Level.WARNING,
                        "Project generation failed userId=" + session.getCreateBy()
                                + " projectId=" + session.getProjectId()
                                + " sessionId=" + session.getId()
                                + " turnId=" + running.getId()
                                + " requestId=" + execution.getRequestId()
                                + " provider=" + execution.getProvider()
                                + " model=" + execution.getModel()
                                + " attemptCount=" + running.getAttemptCount()
                                + " error=" + failureMessage(exception));
            }
            turnStreamRuntime.failed(turnId, failureMessage(exception));
            throw exception;
        } finally {
            if (llmSample != null) {
                conversationMetrics.finishLlmCall(llmSample, execution.getProvider(), llmOutcome.get());
            }
            runningTurnIds.remove(turnId);
            stoppingTurns.remove(turnId);
            turnStreamRuntime.cleanup(turnId);
        }
    }

    private boolean persistProjectGenerationSuccess(
            SessionEntity session, TurnVO running, ProjectCodeGenerationResult result) {
        return Boolean.TRUE.equals(transactionTemplate.execute(status -> {
            TurnVO locked = turnService.queryTurnForUpdate(running.getId()).orElse(null);
            if (locked == null || !TurnStatusEnum.RUNNING.name().equals(locked.getStatus())) {
                return false;
            }

            projectFiles.publish(session.getProjectId(), running.getId(), result.project().files());
            messageService.addMessage(
                    session.getId(), running.getId(), MessageRoleEnum.ASSISTANT, result.project().summary());

            LlmUsage usage = result.usage();
            int updated = turnService.updateTurnSucceeded(
                    running.getId(), session.getId(),
                    usage.inputTokens(), usage.outputTokens(), usage.totalTokens(),
                    result.providerRequestId(), result.finishReason(), DateUtils.now());
            if (updated != 1) {
                throw new IllegalStateException("Turn is no longer RUNNING: " + running.getId());
            }
            return true;
        }));
    }

    private boolean completePublishedGeneration(SessionEntity session, TurnVO running) {
        return Boolean.TRUE.equals(transactionTemplate.execute(status -> {
            TurnVO locked = turnService.queryTurnForUpdate(running.getId()).orElse(null);
            if (locked == null || !TurnStatusEnum.RUNNING.name().equals(locked.getStatus())) {
                return false;
            }
            if (!projectFiles.isPublished(session.getProjectId(), running.getId())) {
                return false;
            }

            messageService.addMessage(
                    session.getId(), running.getId(), MessageRoleEnum.ASSISTANT, RECOVERED_GENERATION_SUMMARY);
            int updated = turnService.updateTurnSucceeded(
                    running.getId(), session.getId(),
                    null, null, null, null, "recovered", DateUtils.now());
            if (updated != 1) {
                throw new IllegalStateException("Turn is no longer RUNNING: " + running.getId());
            }
            return true;
        }));
    }

    private void publishGenerationSucceeded(SessionEntity session, TurnVO running, String requestId) {
        conversationMetrics.turnTerminal("succeeded");
        log.log(
                System.Logger.Level.INFO,
                "Project generation succeeded userId=" + session.getCreateBy()
                        + " projectId=" + session.getProjectId()
                        + " sessionId=" + session.getId()
                        + " turnId=" + running.getId()
                        + " requestId=" + requestId
                        + " provider=" + running.getInvocation().getProvider()
                        + " model=" + running.getInvocation().getModel()
                        + " attemptCount=" + running.getAttemptCount());
        turnStreamRuntime.complete(running.getId());
    }

    private void executeTurnStreaming(String turnId, SessionEntity session, String requestId) {
        TurnVO running = turnService.updatePendingTurn(turnId, DateUtils.now()).orElse(null);
        if (running == null) {
            TurnVO current = turnService.queryTurn(turnId).orElse(null);
            if (current != null && publishTerminalTurn(current)) {
                turnStreamRuntime.cleanup(turnId);
            }
            return;
        }

        runningTurnIds.add(turnId);
        turnStreamRuntime.open(turnId);
        boolean[] completed = {false};
        Timer.Sample llmSample = null;
        AtomicReference<String> llmOutcome = new AtomicReference<>("failure");

        try {
            LlmRequest llmRequest = request(session, running);
            llmSample = conversationMetrics.startLlmCall();
            llmClient.streamingChat(llmRequest, event -> {
                if (stoppingTurns.contains(turnId)) {
                    return;
                }
                if (event.type() == LlmStreamEvent.Type.DELTA) {
                    publishDelta(turnId, event.delta());
                    return;
                }
                if (event.type() == LlmStreamEvent.Type.COMPLETE) {
                    persistSuccess(session.getId(), running, event.response());
                    completed[0] = true;
                    llmOutcome.set("success");
                    conversationMetrics.turnTerminal("succeeded");
                    log.log(
                            System.Logger.Level.INFO,
                            "Turn succeeded userId=" + session.getCreateBy()
                                    + " projectId=" + session.getProjectId()
                                    + " sessionId=" + session.getId()
                                    + " turnId=" + running.getId()
                                    + " requestId=" + requestId
                                    + " provider=" + running.getInvocation().getProvider()
                                    + " model=" + running.getInvocation().getModel()
                                    + " attemptCount=" + running.getAttemptCount());
                    turnStreamRuntime.complete(turnId);
                }
            });

            if (!completed[0]) {
                if (isStopped(turnId)) {
                    llmOutcome.set("stopped");
                } else {
                    throw new IllegalStateException("Streaming turn ended before completion");
                }
            }
        } catch (RuntimeException exception) {
            if (exception instanceof SessionException sessionException) {
                if (sessionException.getErrorCode() == SessionErrorCode.CONTEXT_TOO_LARGE) {
                    conversationMetrics.contextTooLarge();
                } else if (sessionException.getErrorCode() == SessionErrorCode.MESSAGE_TOO_LARGE) {
                    conversationMetrics.messageTooLarge();
                }
            }
            if (shuttingDown.get()) {
                llmOutcome.set("shutdown");
                shutdownRecoveryTurnIds.add(turnId);
                return;
            }
            if (isStopped(turnId)) {
                llmOutcome.set("stopped");
                turnStreamRuntime.stopped(turnId);
                return;
            }
            String partialContent = turnStreamRuntime.snapshot(turnId);
            boolean failed = persistFailure(session.getId(), running, partialContent, exception);
            if (failed) {
                conversationMetrics.turnTerminal("failed");
                log.log(
                        System.Logger.Level.WARNING,
                        "Turn failed userId=" + session.getCreateBy()
                                + " projectId=" + session.getProjectId()
                                + " sessionId=" + session.getId()
                                + " turnId=" + running.getId()
                                + " requestId=" + requestId
                                + " provider=" + running.getInvocation().getProvider()
                                + " model=" + running.getInvocation().getModel()
                                + " attemptCount=" + running.getAttemptCount()
                                + " error=" + failureMessage(exception));
            }
            turnStreamRuntime.failed(turnId, failureMessage(exception));
            throw exception;
        } finally {
            if (llmSample != null) {
                conversationMetrics.finishLlmCall(
                        llmSample, running.getInvocation().getProvider(), llmOutcome.get());
            }
            runningTurnIds.remove(turnId);
            stoppingTurns.remove(turnId);
            turnStreamRuntime.cleanup(turnId);
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
        TurnInvocationVO invocation = running.getInvocation();
        LlmModelMetadata metadata = llmClient.modelMetadata(invocation.getProvider(), invocation.getModel());
        MessageVO currentUser = messageService.queryUserMessage(running.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "USER Message not found for Turn: " + running.getId()));

        List<LlmMessage> context = List.of(toLlmMessage(currentUser));
        long inputBudget = metadata.inputBudgetTokens();
        if (llmClient.estimateTokens(llmRequest(
                invocation.getProvider(), invocation.getModel(), context)) > inputBudget) {
            throw new SessionException(SessionErrorCode.CONTEXT_TOO_LARGE);
        }

        long beforeSequence = currentUser.getSequence();
        Set<String> processedTurnIds = new HashSet<>();
        processedTurnIds.add(running.getId());

        while (beforeSequence > 1) {
            List<MessageVO> rows = messageService.queryMessageBefore(
                    session.getId(), beforeSequence, CONTEXT_HISTORY_BATCH_SIZE);
            if (rows.isEmpty()) {
                break;
            }
            beforeSequence = rows.getLast().getSequence();

            List<String> turnIds = historicalTurnIds(rows, processedTurnIds);
            if (turnIds.isEmpty()) {
                continue;
            }

            Map<String, TurnVO> turnsById = turnService.queryTurnListByIds(turnIds).stream()
                    .collect(Collectors.toMap(TurnVO::getId, turn -> turn));
            Map<String, List<MessageVO>> messagesByTurn = messageService.queryMessageListByTurnIds(turnIds).stream()
                    .collect(Collectors.groupingBy(MessageVO::getTurnId));

            List<List<LlmMessage>> exchanges = turnIds.stream()
                    .map(turnsById::get)
                    .filter(turn -> turn != null && isContextTurn(turn))
                    .map(turn -> contextExchange(messagesByTurn.getOrDefault(turn.getId(), List.of())))
                    .filter(exchange -> !exchange.isEmpty())
                    .toList();
            if (exchanges.isEmpty()) {
                continue;
            }

            List<LlmMessage> batchCandidate = prependExchanges(context, exchanges);
            if (llmClient.estimateTokens(llmRequest(
                    invocation.getProvider(), invocation.getModel(), batchCandidate)) <= inputBudget) {
                context = batchCandidate;
                continue;
            }

            for (List<LlmMessage> exchange : exchanges) {
                List<LlmMessage> candidate = prependExchange(context, exchange);
                if (llmClient.estimateTokens(llmRequest(
                        invocation.getProvider(), invocation.getModel(), candidate)) > inputBudget) {
                    return context;
                }
                context = candidate;
            }
        }
        return context;
    }

    private LlmRequest llmRequest(String provider, String model, List<LlmMessage> messages) {
        return new LlmRequest(provider, model, SYSTEM_PROMPT, messages);
    }

    private static List<String> historicalTurnIds(List<MessageVO> rows, Set<String> processedTurnIds) {
        Set<String> result = new LinkedHashSet<>();
        for (MessageVO row : rows) {
            if (processedTurnIds.add(row.getTurnId())) {
                result.add(row.getTurnId());
            }
        }
        return List.copyOf(result);
    }

    private static List<LlmMessage> contextExchange(List<MessageVO> messages) {
        if (!hasCompleteExchange(messages)) {
            return List.of();
        }
        return messages.stream()
                .sorted(java.util.Comparator.comparing(MessageVO::getSequence))
                .map(SessionServiceImpl::toLlmMessage)
                .toList();
    }

    private static List<LlmMessage> prependExchanges(
            List<LlmMessage> context, List<List<LlmMessage>> exchangesNewestFirst) {
        List<LlmMessage> result = new ArrayList<>();
        for (int index = exchangesNewestFirst.size() - 1; index >= 0; index--) {
            result.addAll(exchangesNewestFirst.get(index));
        }
        result.addAll(context);
        return List.copyOf(result);
    }

    private static List<LlmMessage> prependExchange(List<LlmMessage> context, List<LlmMessage> exchange) {
        List<LlmMessage> result = new ArrayList<>(exchange.size() + context.size());
        result.addAll(exchange);
        result.addAll(context);
        return List.copyOf(result);
    }

    private static List<String> turnIds(List<MessageVO> messages) {
        Set<String> result = new LinkedHashSet<>();
        messages.forEach(message -> result.add(message.getTurnId()));
        return List.copyOf(result);
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

    private boolean persistFailure(
            String sessionId, TurnVO running, String partialContent, RuntimeException originalFailure) {
        LocalDateTime failedAt = DateUtils.now();
        AtomicBoolean transitioned = new AtomicBoolean();

        try {
            transactionTemplate.executeWithoutResult(status -> {
                int failed = turnService.updateTurnFailed(
                        running.getId(), sessionId, failureMessage(originalFailure), failedAt);
                if (failed == 1) {
                    if (!StringUtils.isBlank(partialContent)) {
                        messageService.addMessage(
                                sessionId, running.getId(), MessageRoleEnum.ASSISTANT, partialContent);
                    }
                    transitioned.set(true);
                }
            });
        } catch (RuntimeException persistenceFailure) {
            originalFailure.addSuppressed(persistenceFailure);
            return false;
        }
        return transitioned.get();
    }

    private boolean isStopped(String turnId) {
        return turnService.queryTurn(turnId)
                .map(turn -> TurnStatusEnum.STOPPED.name().equals(turn.getStatus()))
                .orElse(false);
    }

    private void recoverTurns() {
        int recovered = turnService.updateStaleTurnPending(DateUtils.now().minus(runningTimeout));
        conversationMetrics.recovered("stale", recovered);
        if (recovered > 0) {
            log.log(System.Logger.Level.INFO, "Recovered stale RUNNING Turns to PENDING count=" + recovered);
        }
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

    private boolean publishTerminalTurn(TurnVO turn) {
        if (TurnStatusEnum.SUCCEEDED.name().equals(turn.getStatus())) {
            turnStreamRuntime.complete(turn.getId());
            return true;
        }
        if (TurnStatusEnum.FAILED.name().equals(turn.getStatus())) {
            turnStreamRuntime.failed(
                    turn.getId(), turn.getErrorMessage() == null ? "Turn failed." : turn.getErrorMessage());
            return true;
        }
        if (TurnStatusEnum.STOPPED.name().equals(turn.getStatus())) {
            turnStreamRuntime.stopped(turn.getId());
            return true;
        }
        return false;
    }

    private void publishDelta(String turnId, String delta) {
        try {
            turnStreamRuntime.delta(turnId, delta);
        } catch (TurnStreamRuntime.BufferLimitExceededException exception) {
            throw new SessionException(SessionErrorCode.MESSAGE_TOO_LARGE);
        }
    }

    private SessionEntity queryOwnedSession(String projectId, String sessionId, String userId) {
        return sessionRepository.querySession(projectId, sessionId, userId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
    }

    private static TurnNavigationItemVO toTurnNavigationItemVO(MessageVO message) {
        TurnNavigationItemVO result = new TurnNavigationItemVO();
        result.setTurnId(message.getTurnId());
        result.setUserMessageId(message.getId());
        result.setUserMessageSequence(message.getSequence());
        result.setPreview(navigationPreview(message.getContent()));
        return result;
    }

    private static String navigationPreview(String content) {
        if (content == null) {
            return "";
        }
        String normalized = content.replaceAll("\\s+", " ").strip();
        int codePoints = normalized.codePointCount(0, normalized.length());
        if (codePoints <= TURN_NAVIGATION_PREVIEW_MAX_CODE_POINTS) {
            return normalized;
        }
        int end = normalized.offsetByCodePoints(0, TURN_NAVIGATION_PREVIEW_MAX_CODE_POINTS);
        return normalized.substring(0, end);
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
