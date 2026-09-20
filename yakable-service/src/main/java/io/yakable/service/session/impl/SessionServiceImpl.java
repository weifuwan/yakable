package io.yakable.service.session.impl;

import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.CancelTurnDTO;
import io.yakable.common.bean.dto.session.QuerySessionChangesDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.bean.vo.session.SessionChangesVO;
import io.yakable.common.bean.vo.session.SessionDetailVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.SessionModelVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.enums.session.SessionStatusEnum;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.exception.SessionException;
import io.yakable.common.utils.ConverUtils;
import io.yakable.common.utils.DateUtils;
import io.yakable.common.utils.StringUtils;
import io.yakable.common.utils.ThreadUtils;
import io.yakable.core.llm.LlmClient;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmStreamEvent;
import io.yakable.core.llm.LlmUsage;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.message.MessageService;
import io.yakable.service.session.SessionService;
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
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Validated
public class SessionServiceImpl implements SessionService {

    private static final String SYSTEM_PROMPT = "You are Yakable, a concise and accurate assistant.";
    private static final String TURN_RECOVERY_TASK = "turn-recovery";
    private static final String TURN_TASK_PREFIX = "turn-";
    private static final String TURN_STREAM_TASK_PREFIX = "turn-stream-";
    private static final int RECOVERY_BATCH_SIZE = 100;

    private final Map<String, StringBuffer> streamingContents = new ConcurrentHashMap<>();
    private final Set<String> cancellingTurns = ConcurrentHashMap.newKeySet();

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

    @Value("${yakable.session.context.max-history-turns:20}")
    private int maxHistoryTurns;

    @PostConstruct
    void startTurnRecovery() {
        ThreadUtils.scheduleWithFixedDelay(TURN_RECOVERY_TASK, this::recoverTurns, recoveryInterval);
    }

    @PreDestroy
    void stopTurnRecovery() {
        ThreadUtils.cancelScheduled(TURN_RECOVERY_TASK);
    }

    @Override
    public SessionInitVO addSession(AddSessionDTO dto) {
        SessionEntity session = ConverUtils.convert(dto, SessionEntity.class);
        session.initCreate();
        session.setStatus(SessionStatusEnum.ACTIVE);
        sessionRepository.add(session);

        TurnStartVO turn = addPendingTurn(session, dto.content());

        SessionInitVO result = new SessionInitVO();
        result.setSessionId(session.getId());
        result.setUpdatedAt(session.getUpdateTime());
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
    public TurnVO cancelTurn(CancelTurnDTO dto) {
        queryOwnedSession(dto.projectId(), dto.sessionId());
        TurnExecutionVO execution = turnService.queryTurnExecution(dto.turnId())
                .filter(turn -> dto.sessionId().equals(turn.getSessionId()))
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));

        StringBuffer streamingContent = streamingContents.get(dto.turnId());
        if (streamingContent != null) {
            cancellingTurns.add(dto.turnId());
        }

        int updated;
        try {
            String partialContent = snapshotStreamingContent(streamingContent);
            updated = transactionTemplate.execute(status -> {
                int cancelled = turnService.updateTurnCancelled(execution.getId(), dto.sessionId(), DateUtils.now());
                if (cancelled == 1) {
                    if (!StringUtils.isBlank(partialContent)) {
                        messageService.addMessage(
                                dto.sessionId(), dto.turnId(), MessageRoleEnum.ASSISTANT, partialContent);
                    }
                    updateSession(dto.sessionId());
                }
                return cancelled;
            });
        } catch (RuntimeException exception) {
            cancellingTurns.remove(dto.turnId());
            throw exception;
        }

        if (updated == 1) {
            ThreadUtils.cancel(TURN_TASK_PREFIX + dto.turnId());
            ThreadUtils.cancel(TURN_STREAM_TASK_PREFIX + dto.turnId());
        } else {
            cancellingTurns.remove(dto.turnId());
        }
        return turnService.queryTurn(dto.turnId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
    }

    @Override
    public void executeTurnAsync(String turnId) {
        ThreadUtils.execute(TURN_TASK_PREFIX + turnId, () -> executeTurn(turnId));
    }

    @Override
    public void executeTurnStreamingAsync(
            String turnId, Consumer<LlmStreamEvent> consumer, Consumer<RuntimeException> errorHandler) {
        ThreadUtils.execute(TURN_STREAM_TASK_PREFIX + turnId, () -> {
            try {
                executeTurnStreaming(turnId, consumer);
            } catch (RuntimeException exception) {
                errorHandler.accept(exception);
            }
        });
    }

    @Override
    public SessionDetailVO querySession(QuerySessionDTO dto) {
        SessionEntity session = queryOwnedSession(dto.projectId(), dto.sessionId());

        SessionDetailVO result = new SessionDetailVO();
        result.setSession(toSessionVO(session));
        result.setTurns(turnService.queryTurnList(dto.sessionId()));
        result.setMessages(messageService.queryMessageList(dto.sessionId()));
        return result;
    }

    @Override
    public Optional<SessionVO> queryLatestSession(String projectId) {
        return sessionRepository.queryLatestSession(projectId).map(SessionServiceImpl::toSessionVO);
    }

    @Override
    public Map<String, SessionVO> queryLatestSessionMap(List<String> projectIds) {
        return sessionRepository.queryLatestSessionList(projectIds)
                .stream()
                .map(SessionServiceImpl::toSessionVO)
                .collect(Collectors.toMap(SessionVO::getProjectId, Function.identity()));
    }

    @Override
    public SessionChangesVO querySessionChanges(QuerySessionChangesDTO dto) {
        queryOwnedSession(dto.projectId(), dto.sessionId());

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
        queryOwnedSession(dto.projectId(), dto.sessionId());

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
            SessionEntity session = queryOwnedSession(dto.projectId(), dto.sessionId());
            if (session.getStatus() != SessionStatusEnum.ACTIVE) {
                throw new SessionException(SessionErrorCode.INACTIVE);
            }
            return addPendingTurn(session, dto.content());
        });
    }

    private TurnStartVO addPendingTurn(SessionEntity session, String content) {
        if (!sessionRepository.querySessionForUpdate(session.getId())) {
            throw new SessionException(SessionErrorCode.NOT_FOUND);
        }
        if (turnService.queryActiveTurnCount(session.getId()) > 0) {
            throw new SessionException(SessionErrorCode.BUSY);
        }

        TurnVO turn = turnService.addTurn(session.getId());
        MessageVO message = messageService.addMessage(session.getId(), turn.getId(), MessageRoleEnum.USER, content);

        session.initUpdate();
        sessionRepository.update(session);

        TurnStartVO result = new TurnStartVO();
        result.setTurn(turn);
        result.setUserMessage(message);
        return result;
    }

    private void executeTurn(String turnId) {
        TurnExecutionVO snapshot = turnService.queryTurnExecution(turnId).orElse(null);
        if (snapshot == null) {
            return;
        }

        SessionEntity session = sessionRepository.queryById(snapshot.getSessionId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));

        TurnVO running = turnService.updatePendingTurn(
                turnId, DateUtils.now(), session.getProvider(), session.getModel()).orElse(null);
        if (running == null) {
            return;
        }

        try {
            LlmResponse response = llmClient.chat(request(session, running));
            persistSuccess(session.getId(), running, response);
        } catch (RuntimeException exception) {
            persistFailure(session.getId(), running, exception);
            throw exception;
        }
    }

    private void executeTurnStreaming(String turnId, Consumer<LlmStreamEvent> consumer) {
        TurnExecutionVO snapshot = turnService.queryTurnExecution(turnId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
        SessionEntity session = sessionRepository.queryById(snapshot.getSessionId())
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
        TurnVO running = turnService.updatePendingTurn(
                turnId, DateUtils.now(), session.getProvider(), session.getModel())
                .orElseThrow(() -> new SessionException(SessionErrorCode.BUSY));
        StringBuffer streamingContent = new StringBuffer();
        streamingContents.put(turnId, streamingContent);

        try {
            llmClient.streamingChat(request(session, running), event -> {
                if (event.type() == LlmStreamEvent.Type.DELTA) {
                    synchronized (streamingContent) {
                        if (cancellingTurns.contains(turnId)) {
                            return;
                        }
                        streamingContent.append(event.delta());
                    }
                }
                if (cancellingTurns.contains(turnId)) {
                    return;
                }
                if (event.type() == LlmStreamEvent.Type.COMPLETE) {
                    persistSuccess(session.getId(), running, event.response());
                }
                consumer.accept(event);
            });
        } catch (RuntimeException exception) {
            if (isCancelled(turnId)) {
                return;
            }
            persistFailure(session.getId(), running, exception);
            throw exception;
        } finally {
            streamingContents.remove(turnId, streamingContent);
            cancellingTurns.remove(turnId);
        }
    }

    private LlmRequest request(SessionEntity session, TurnVO running) {
        return new LlmRequest(
                session.getProvider(), session.getModel(), SYSTEM_PROMPT, buildContext(session.getId(), running.getId()));
    }

    private List<LlmMessage> buildContext(String sessionId, String currentTurnId) {
        List<MessageVO> messages = messageService.queryMessageList(sessionId);
        Map<String, List<MessageVO>> messagesByTurn = messages.stream()
                .collect(Collectors.groupingBy(MessageVO::getTurnId));

        List<TurnVO> turns = turnService.queryTurnList(sessionId);
        Set<String> selectedTurnIds = new HashSet<>();
        selectedTurnIds.add(currentTurnId);

        int remaining = Math.max(0, maxHistoryTurns);
        for (int index = turns.size() - 1; index >= 0 && remaining > 0; index--) {
            TurnVO turn = turns.get(index);
            if (currentTurnId.equals(turn.getId()) || !isContextTurn(turn)) {
                continue;
            }
            if (!hasCompleteExchange(messagesByTurn.getOrDefault(turn.getId(), List.of()))) {
                continue;
            }
            selectedTurnIds.add(turn.getId());
            remaining--;
        }

        return messages.stream()
                .filter(message -> selectedTurnIds.contains(message.getTurnId()))
                .map(SessionServiceImpl::toLlmMessage)
                .toList();
    }

    private static boolean isContextTurn(TurnVO turn) {
        return TurnStatusEnum.SUCCEEDED.name().equals(turn.getStatus())
                || TurnStatusEnum.CANCELLED.name().equals(turn.getStatus());
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
                    running.getId(), sessionId, response.provider(), response.model(),
                    usage.inputTokens(), usage.outputTokens(), usage.totalTokens(),
                    response.providerRequestId(), response.finishReason(), completedAt);
            if (updated != 1) {
                throw new IllegalStateException("Turn is no longer RUNNING: " + running.getId());
            }

            messageService.addMessage(sessionId, running.getId(), MessageRoleEnum.ASSISTANT, response.content());
            updateSession(sessionId);
        });
    }

    private void persistFailure(String sessionId, TurnVO running, RuntimeException originalFailure) {
        LocalDateTime failedAt = DateUtils.now();

        try {
            transactionTemplate.executeWithoutResult(status -> {
                turnService.updateTurnFailed(running.getId(), sessionId, failureMessage(originalFailure), failedAt);
                updateSession(sessionId);
            });
        } catch (RuntimeException persistenceFailure) {
            originalFailure.addSuppressed(persistenceFailure);
        }
    }

    private boolean isCancelled(String turnId) {
        return turnService.queryTurn(turnId)
                .map(turn -> TurnStatusEnum.CANCELLED.name().equals(turn.getStatus()))
                .orElse(false);
    }

    private static String snapshotStreamingContent(StringBuffer content) {
        if (content == null) {
            return "";
        }
        synchronized (content) {
            return content.toString();
        }
    }

    private void recoverTurns() {
        turnService.updateStaleTurnPending(DateUtils.now().minus(runningTimeout));
        turnService.queryPendingTurnIdList(RECOVERY_BATCH_SIZE).forEach(this::executeTurnAsync);
    }

    private void updateSession(String sessionId) {
        SessionEntity session = sessionRepository.queryById(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
        session.initUpdate();
        sessionRepository.update(session);
    }

    private SessionEntity queryOwnedSession(String projectId, String sessionId) {
        return sessionRepository.querySession(projectId, sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
    }

    private static SessionVO toSessionVO(SessionEntity entity) {
        SessionVO result = ConverUtils.convert(entity, SessionVO.class);
        result.setModel(ConverUtils.convert(entity, SessionModelVO.class));
        result.setStatus(entity.getStatus().name());
        result.setCreatedAt(entity.getCreateTime());
        result.setUpdatedAt(entity.getUpdateTime());
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
