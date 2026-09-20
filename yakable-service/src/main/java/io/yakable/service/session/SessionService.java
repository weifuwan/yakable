package io.yakable.service.session;

import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.dto.session.AddTurnDTO;
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
import io.yakable.common.bean.vo.session.TokenUsageVO;
import io.yakable.common.bean.vo.session.TurnInvocationVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.enums.session.SessionStatusEnum;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.exception.SessionException;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.turn.TurnDispatcher;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Session 业务服务。
 *
 * <p>负责 Session、Turn 和 Message 的业务编排与查询。</p>
 */
@Service
@Validated
public class SessionService {

    @Resource
    private SessionRepository sessionRepository;

    @Resource
    private TurnDispatcher turnDispatcher;

    @Resource
    private TransactionTemplate transactionTemplate;

    /**
     * 新增 Session，并创建首个 Turn 和用户 Message。
     *
     * @param dto 新增 Session 入参
     * @return Session 初始化结果
     */
    public SessionInitVO addSession(@NotNull @Valid AddSessionDTO dto) {
        SessionEntity session = new SessionEntity();
        session.initCreate();
        session.setProjectId(StringUtils.strip(dto.projectId()));
        session.setTitle(StringUtils.strip(dto.title()));
        session.setProvider(StringUtils.strip(dto.provider()));
        session.setModel(StringUtils.strip(dto.model()));
        session.setStatus(SessionStatusEnum.ACTIVE);
        sessionRepository.saveSession(session);

        TurnStartVO turn = addPendingTurn(session, StringUtils.strip(dto.content()));

        SessionInitVO result = new SessionInitVO();
        result.setSessionId(session.getId());
        result.setUpdatedAt(session.getUpdateTime());
        result.setTurnId(turn.getTurn().getId());
        return result;
    }

    /**
     * 新增 Turn。
     *
     * @param dto 新增 Turn 入参
     * @return Turn 创建结果
     */
    public TurnStartVO addTurn(@NotNull @Valid AddTurnDTO dto) {
        String projectId = StringUtils.strip(dto.projectId());
        String sessionId = StringUtils.strip(dto.sessionId());
        String content = StringUtils.strip(dto.content());

        TurnStartVO result = transactionTemplate.execute(status -> {
            SessionEntity session = queryOwnedSession(projectId, sessionId);
            if (session.getStatus() != SessionStatusEnum.ACTIVE) {
                throw new SessionException(SessionErrorCode.INACTIVE);
            }
            return addPendingTurn(session, content);
        });

        turnDispatcher.dispatch(result.getTurn().getId());
        return result;
    }

    /**
     * 查询 Session 详情。
     *
     * @param dto Session 查询入参
     * @return Session 详情
     */
    public SessionDetailVO querySession(@NotNull @Valid QuerySessionDTO dto) {
        String projectId = StringUtils.strip(dto.projectId());
        String sessionId = StringUtils.strip(dto.sessionId());
        SessionEntity session = queryOwnedSession(projectId, sessionId);

        SessionDetailVO result = new SessionDetailVO();
        result.setSession(toSessionVO(session));
        result.setTurns(sessionRepository.findTurnsBySessionId(sessionId).stream().map(SessionService::toTurnVO).toList());
        result.setMessages(sessionRepository.findMessagesBySessionId(sessionId).stream().map(SessionService::toMessageVO).toList());
        return result;
    }

    /**
     * 查询 Session 增量变化。
     *
     * @param dto Session 增量查询入参
     * @return Session 增量变化
     */
    public SessionChangesVO querySessionChanges(@NotNull @Valid QuerySessionChangesDTO dto) {
        String projectId = StringUtils.strip(dto.projectId());
        String sessionId = StringUtils.strip(dto.sessionId());
        queryOwnedSession(projectId, sessionId);

        TurnEntity latest = sessionRepository.findLatestTurn(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));

        SessionChangesVO result = new SessionChangesVO();
        result.setLatestTurn(toTurnVO(latest));
        result.setMessages(sessionRepository.findMessagesAfter(sessionId, dto.afterSequence())
                .stream().map(SessionService::toMessageVO).toList());
        result.setLatestSequence(sessionRepository.latestMessageSequence(sessionId));
        return result;
    }

    /**
     * 查询 Session 消息。
     *
     * @param dto Session 消息查询入参
     * @return Session 消息分页数据
     */
    public SessionMessagePageVO querySessionMessage(@NotNull @Valid QuerySessionMessagesDTO dto) {
        String projectId = StringUtils.strip(dto.projectId());
        String sessionId = StringUtils.strip(dto.sessionId());
        queryOwnedSession(projectId, sessionId);

        List<MessageEntity> rows = sessionRepository.findMessagesBefore(sessionId, dto.beforeSequence(), dto.limit() + 1);
        boolean hasMore = rows.size() > dto.limit();
        List<MessageEntity> pageRows = hasMore ? rows.subList(0, dto.limit()) : rows;

        List<MessageVO> messages = new ArrayList<>(pageRows.stream().map(SessionService::toMessageVO).toList());
        Collections.reverse(messages);

        SessionMessagePageVO result = new SessionMessagePageVO();
        result.setMessages(messages);
        result.setNextBeforeSequence(hasMore && !messages.isEmpty() ? messages.get(0).getSequence() : null);
        result.setHasMore(hasMore);
        return result;
    }

    private TurnStartVO addPendingTurn(SessionEntity session, String content) {
        if (!sessionRepository.lockSession(session.getId())) {
            throw new SessionException(SessionErrorCode.NOT_FOUND);
        }
        if (sessionRepository.countActiveTurns(session.getId()) > 0) {
            throw new SessionException(SessionErrorCode.BUSY);
        }

        TurnEntity turn = new TurnEntity();
        turn.initCreate();
        turn.setSessionId(session.getId());
        turn.setStatus(TurnStatusEnum.PENDING);
        turn.setAttemptCount(0);
        sessionRepository.insertTurn(turn);

        MessageEntity message = new MessageEntity();
        message.initCreate();
        message.setSessionId(session.getId());
        message.setTurnId(turn.getId());
        message.setRole(MessageRoleEnum.USER);
        message.setContent(content);
        message.setMessageSequence(sessionRepository.nextMessageSequence(session.getId()));
        sessionRepository.insertMessage(message);

        session.initUpdate();
        sessionRepository.saveSession(session);

        TurnStartVO result = new TurnStartVO();
        result.setTurn(toTurnVO(turn));
        result.setUserMessage(toMessageVO(message));
        return result;
    }

    private SessionEntity queryOwnedSession(String projectId, String sessionId) {
        return sessionRepository.findOwnedSession(projectId, sessionId)
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

    private static TurnVO toTurnVO(TurnEntity entity) {
        TurnVO result = ConverUtils.convert(entity, TurnVO.class);
        result.setStatus(entity.getStatus().name());
        result.setAttemptCount(entity.getAttemptCount() == null ? 0 : entity.getAttemptCount());
        result.setInvocation(toInvocationVO(entity));
        result.setDurationMs(durationMillis(entity));
        result.setCreatedAt(entity.getCreateTime());
        result.setUpdatedAt(entity.getUpdateTime());
        return result;
    }

    private static TurnInvocationVO toInvocationVO(TurnEntity entity) {
        if (entity.getProvider() == null && entity.getModel() == null) {
            return null;
        }

        TurnInvocationVO result = ConverUtils.convert(entity, TurnInvocationVO.class);
        if (entity.getInputTokens() != null || entity.getOutputTokens() != null || entity.getTotalTokens() != null) {
            result.setUsage(ConverUtils.convert(entity, TokenUsageVO.class));
        }
        return result;
    }

    private static MessageVO toMessageVO(MessageEntity entity) {
        MessageVO result = ConverUtils.convert(entity, MessageVO.class);
        result.setRole(entity.getRole().name());
        result.setSequence(entity.getMessageSequence());
        result.setCreatedAt(entity.getCreateTime());
        return result;
    }

    private static Long durationMillis(TurnEntity entity) {
        if (entity.getStartedAt() == null || entity.getFinishedAt() == null) {
            return null;
        }
        return Duration.between(entity.getStartedAt(), entity.getFinishedAt()).toMillis();
    }

}
