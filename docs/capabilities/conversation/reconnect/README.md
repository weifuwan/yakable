# Reconnect

## 能力

浏览器刷新、页面重开或 SSE 断开后，重新观察同一个活动 Turn，而不是重新提交 Prompt。

## 用户行为

```text
Streaming
→ refresh / disconnect
→ reopen Session
→ find same active turnId
→ snapshot
→ future delta
→ terminal
```

用户不应该看到重复 USER Message、重复 Turn 或重复 Assistant 文本。

## 边界

Reconnect 处理浏览器 / transport 恢复。

它不负责服务进程崩溃后的重新执行；那属于 [Recovery](../recovery/)。

## 流程

```text
SessionWorkspace mount
→ querySession()
→ find PENDING / RUNNING Turn
→ watchTurn(turnId)
→ POST /turns/{turnId}/stream
→ backend watcher
→ snapshot
→ delta
```

Watcher 失败时，前端使用已有 `/changes` 查询继续收敛状态。

Reconnect 永远不能创建新的 Turn。

## 代码

Frontend：

```text
SessionWorkspace.tsx
SessionService.watchTurn()
SessionService.queryChanges()
```

Backend：

```text
SessionController.watchTurn()
SessionService.watchTurn()
SessionServiceImpl.watchTurn()
TurnStreamState
```

## 测试

保护：

- refresh 使用原 turnId。
- 新 watcher 先得到 snapshot。
- 后续 delta 不重复。
- disconnect 不 Stop。
- watcher 失败后 changes fallback。
- terminal Turn 最终收敛到持久化结果。

## 依赖

依赖 [Streaming](../streaming/)。

服务端执行异常进入 [Recovery](../recovery/)。
