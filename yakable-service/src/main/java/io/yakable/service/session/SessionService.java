package io.yakable.service.session;

import io.yakable.common.bean.dto.session.AddSessionDTO;
import io.yakable.common.bean.dto.session.AddTurnDTO;
import io.yakable.common.bean.dto.session.StopTurnDTO;
import io.yakable.common.bean.dto.session.QuerySessionChangesDTO;
import io.yakable.common.bean.dto.session.QuerySessionDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessagesDTO;
import io.yakable.common.bean.dto.session.QuerySessionMessageWindowDTO;
import io.yakable.common.bean.dto.session.QuerySessionTurnNavigationDTO;
import io.yakable.common.bean.dto.session.WatchTurnDTO;
import io.yakable.common.bean.vo.session.SessionChangesVO;
import io.yakable.common.bean.vo.session.SessionDetailVO;
import io.yakable.common.bean.vo.session.SessionInitVO;
import io.yakable.common.bean.vo.session.SessionMessagePageVO;
import io.yakable.common.bean.vo.session.SessionMessageWindowVO;
import io.yakable.common.bean.vo.session.SessionVO;
import io.yakable.common.bean.vo.session.TurnNavigationItemVO;
import io.yakable.common.bean.vo.session.TurnStartVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.core.conversation.stream.TurnStreamListener;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Optional;

/**
 * Session 业务服务。
 */
public interface SessionService {

    /**
     * 新增 Session，并创建首个 Turn 和用户 Message。
     */
    SessionInitVO addSession(@NotNull @Valid AddSessionDTO dto);

    /**
     * 新增 Turn。
     */
    TurnStartVO addTurn(@NotNull @Valid AddTurnDTO dto);

    /**
     * 新增流式 Turn。
     */
    TurnStartVO addStreamingTurn(@NotNull @Valid AddTurnDTO dto);

    /**
     * 停止 Turn。
     */
    TurnVO stopTurn(@NotNull @Valid StopTurnDTO dto);

    /**
     * 异步执行 Turn。
     */
    void executeTurnAsync(String turnId);

    /**
     * 订阅已存在 Turn 的流式输出。
     *
     * @return 取消订阅动作
     */
    Runnable watchTurn(@NotNull @Valid WatchTurnDTO dto, @NotNull TurnStreamListener listener);

    /**
     * 查询 Session 详情。
     */
    SessionDetailVO querySession(@NotNull @Valid QuerySessionDTO dto);

    /**
     * 查询 Project 最新 Session。
     */
    Optional<SessionVO> queryLatestSession(String projectId);

    /**
     * 查询 Session 增量变化。
     */
    SessionChangesVO querySessionChanges(@NotNull @Valid QuerySessionChangesDTO dto);

    /**
     * 查询 Session 消息。
     */
    SessionMessagePageVO querySessionMessage(@NotNull @Valid QuerySessionMessagesDTO dto);

    /**
     * 查询 Session 的 Turn 导航索引。
     */
    List<TurnNavigationItemVO> queryTurnNavigation(@NotNull @Valid QuerySessionTurnNavigationDTO dto);

    /**
     * 查询指定 Message 序号附近的消息窗口。
     */
    SessionMessageWindowVO queryMessageWindow(@NotNull @Valid QuerySessionMessageWindowDTO dto);
}
