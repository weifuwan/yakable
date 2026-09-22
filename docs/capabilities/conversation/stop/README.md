# Stop

## 能力

用户显式停止当前正在生成的 Turn。

## 用户行为

```text
Streaming
→ click Stop
→ 已生成内容保留
→ Turn = STOPPED
→ Session 可以继续发送下一轮
```

Stop 是业务动作；关闭页面、SSE timeout、网络断开都不是 Stop。

## 边界

负责：

- 明确 turnId。
- 取消 / 中止后台执行。
- 保存非空 partial Assistant。
- Turn 原子进入 STOPPED。
- 通知 watcher。

不负责：

- transport disconnect。
- 页面卸载。
- Recovery。

## 流程

```text
SessionWorkspace.handleStop
→ SessionService.stopTurn()
→ POST /turns/{turnId}/stop
→ SessionController.stopTurn()
→ SessionService.stopTurn()
→ persist partial content
→ TurnService.updateTurnStopped()
→ cancel execution
→ stream state stopped
```

## 代码

Frontend：

```text
SessionWorkspace.tsx
yakable-ui/src/service/session/SessionService.ts
```

Backend：

```text
SessionController.stopTurn()
SessionServiceImpl.stopTurn()
TurnService
MessageService
```

## 测试

保护：

- USER Message 不丢。
- partial Assistant 非空时保留。
- 重复 Stop 不覆盖终态。
- Stop 后可以下一轮。
- SSE disconnect 不走 Stop。

## 依赖

依赖 [Streaming](../streaming/) 的运行状态与 Buffer。
