package io.yakable.service.session.impl;

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
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.enums.session.SessionStatusEnum;
import io.yakable.common.exception.SessionException;
import io.yakable.common.utils.ConverUtils;
import io.yakable.dao.entity.SessionEntity;
import io.yakable.dao.repository.SessionRepository;
import io.yakable.service.message.MessageService;
import io.yakable.service.session.SessionService;
import io.yakable.service.turn.TurnDispatcher;
import io.yakable.service.turn.TurnService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.validation.annotation.Validated;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Validated
public class SessionServiceImpl implements SessionService {

    @Resource
    private SessionRepository sessionRepository;

    @Resource
    private TurnService turnService;

    @Resource
    private MessageService messageService;

    @Resource
    private TurnDispatcher turnDispatcher;

    @Resource
    private TransactionTemplate transactionTemplate;

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
        TurnStartVO result = transactionTemplate.execute(status -> {
            SessionEntity session = queryOwnedSession(dto.projectId(), dto.sessionId());
            if (session.getStatus() != SessionStatusEnum.ACTIVE) {
                throw new SessionException(SessionErrorCode.INACTIVE);
            }
            return addPendingTurn(session, dto.content());
        });

        turnDispatcher.dispatch(result.getTurn().getId());
        return result;
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
    public Optional<SessionVO> querySession(String sessionId) {
        return sessionRepository.queryById(sessionId).map(SessionServiceImpl::toSessionVO);
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
    public void updateSession(String sessionId) {
        SessionEntity session = sessionRepository.queryById(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND));
        session.initUpdate();
        sessionRepository.update(session);
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
}
