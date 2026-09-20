package io.yakable.service.turn;

import io.yakable.common.bean.vo.session.MessageVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.utils.DateUtils;
import io.yakable.service.message.MessageService;
import io.yakable.service.model.ModelClient;
import io.yakable.service.session.SessionService;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class TurnExecutor {

    private static final String SYSTEM_PROMPT = "You are Yakable, a concise and accurate assistant.";

    private final SessionService sessionService;
    private final TurnService turnService;
    private final MessageService messageService;
    private final ModelClient modelClient;
    private final TransactionTemplate transactionTemplate;

    public TurnExecutor(
            SessionService sessionService,
            TurnService turnService,
            MessageService messageService,
            ModelClient modelClient,
            TransactionTemplate transactionTemplate) {
        this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
        this.turnService = Objects.requireNonNull(turnService, "turnService");
        this.messageService = Objects.requireNonNull(messageService, "messageService");
        this.modelClient = Objects.requireNonNull(modelClient, "modelClient");
        this.transactionTemplate = Objects.requireNonNull(transactionTemplate, "transactionTemplate");
    }

    public boolean execute(String turnId) {
        TurnExecutionVO snapshot = turnService.queryTurnExecution(turnId).orElse(null);
        if (snapshot == null) {
            return false;
        }

        SessionVO session = sessionService.querySession(snapshot.getSessionId())
                .orElseThrow(() -> new IllegalStateException("Session does not exist: " + snapshot.getSessionId()));

        TurnVO running = turnService.updatePendingTurn(
                turnId, DateUtils.now(), session.getModel().getProvider(), session.getModel().getModel()).orElse(null);

        if (running == null) {
            return false;
        }

        try {
            ModelClient.Reply reply = modelClient.chat(
                    session.getModel().getProvider(),
                    session.getModel().getModel(),
                    SYSTEM_PROMPT,
                    buildContext(session.getId(), running.getId()));
            persistSuccess(session, running, reply);
            return true;
        } catch (RuntimeException exception) {
            persistFailure(session, running, exception);
            throw exception;
        }
    }

    private List<ModelClient.Message> buildContext(String sessionId, String currentTurnId) {
        Map<String, TurnVO> turns = turnService.queryTurnList(sessionId)
                .stream()
                .collect(Collectors.toMap(TurnVO::getId, Function.identity()));

        return messageService.queryMessageList(sessionId)
                .stream()
                .filter(message -> {
                    if (currentTurnId.equals(message.getTurnId())) {
                        return true;
                    }
                    TurnVO turn = turns.get(message.getTurnId());
                    return turn != null && TurnStatusEnum.SUCCEEDED.name().equals(turn.getStatus());
                })
                .map(TurnExecutor::toModelMessage)
                .toList();
    }

    private void persistSuccess(SessionVO session, TurnVO running, ModelClient.Reply reply) {
        LocalDateTime completedAt = DateUtils.now();
        ModelClient.Usage usage = reply.usage();

        transactionTemplate.executeWithoutResult(status -> {
            int updated = turnService.updateTurnSucceeded(
                    running.getId(),
                    session.getId(),
                    reply.provider(),
                    reply.model(),
                    usage == null ? null : usage.inputTokens(),
                    usage == null ? null : usage.outputTokens(),
                    usage == null ? null : usage.totalTokens(),
                    reply.providerRequestId(),
                    reply.finishReason(),
                    completedAt);
            if (updated != 1) {
                throw new IllegalStateException("Turn is no longer RUNNING: " + running.getId());
            }

            messageService.addMessage(session.getId(), running.getId(), MessageRoleEnum.ASSISTANT, reply.content());
            sessionService.updateSession(session.getId());
        });
    }

    private void persistFailure(SessionVO session, TurnVO running, RuntimeException originalFailure) {
        LocalDateTime failedAt = DateUtils.now();

        try {
            transactionTemplate.executeWithoutResult(status -> {
                turnService.updateTurnFailed(running.getId(), session.getId(), failureMessage(originalFailure), failedAt);
                sessionService.updateSession(session.getId());
            });
        } catch (RuntimeException persistenceFailure) {
            originalFailure.addSuppressed(persistenceFailure);
        }
    }

    private static ModelClient.Message toModelMessage(MessageVO message) {
        ModelClient.Role role = MessageRoleEnum.USER.name().equals(message.getRole())
                ? ModelClient.Role.USER
                : ModelClient.Role.ASSISTANT;
        return new ModelClient.Message(role, message.getContent());
    }

    private static String failureMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message.strip();
    }
}
