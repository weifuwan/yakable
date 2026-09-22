# Recovery

## 能力

让已经持久化但未完成的 Turn 在调度失败、服务重启或 RUNNING 超时后，不永久卡死。

## 用户行为

用户不直接操作 Recovery。

用户只应该看到：

- 原 Turn 最终继续执行或进入明确终态。
- 不出现第二个 USER Message。
- 不出现替代 Turn。

## 边界

负责服务端执行恢复，不负责浏览器 SSE 重连。

```text
PENDING
→ later dispatch

stale RUNNING
→ PENDING
→ same Turn claim again
```

正常停机时，未完成的本机 RUNNING Turn 也回到 PENDING，再由下一次启动继续。

## 流程

```text
scheduled recovery
→ update stale RUNNING to PENDING
→ query bounded PENDING ids
→ executeTurnAsync(turnId)
→ acquire execution slot
→ claim
→ execute
```

Recovery 使用原 Turn、原 USER Message、原 provider / model。

## 代码

Backend：

```text
SessionServiceImpl
  startTurnRecovery()
  recoverTurns()
  executeTurnAsync()

TurnService
  updateRunningTurnPending()
  updateStaleTurnPending()
  queryPendingTurnIdList()
```

运行时恢复批次和执行并发都有边界，不把 PENDING Turn 全部塞进无限内存队列。

## 测试

保护：

- stale RUNNING → PENDING。
- 同一 Turn 再次 claim。
- Recovery 不创建 Message / Turn。
- graceful shutdown 回收运行中 Turn。
- 终态不可被 Recovery 覆盖。

## 依赖

依赖持久化 Turn 状态与 [Streaming](../streaming/) 的执行生命周期。
