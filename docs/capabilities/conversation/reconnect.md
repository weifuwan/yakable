# Reconnect

Status: Implementing
Domain: Conversation

Depends On:
- [Streaming](./streaming.md)
- [History](./history.md)

Related:
- [Stop](./stop.md)
- [Recovery](./recovery.md)

Frontend:
- `yakable-ui/src/features/session/components/SessionWorkspace.tsx`
- `yakable-ui/src/service/session/SessionService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- `yakable-service/src/main/java/io/yakable/service/session/SessionService.java`
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`

Data:
- Session
- Turn
- Message

Shared Rules:
- CONV-001
- CONV-004
- CONV-005
- CONV-006
- CONV-007
- CONV-013
- CONV-016
- CONV-020
- CONV-022

Scenarios:
- CONV-S03
- CONV-S04
- CONV-S08
- CONV-S09

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/service/session/__tests__/SessionService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`

Implementation Design:
- Active Turn watcher 失败后保留当前 streamingContent，不立即清空用户已经看到的 partial。
- watch failure 先调用 queryChanges 作为持久化状态兜底。
- 如果 queryChanges 确认 Turn 已进入 SUCCEEDED / FAILED / STOPPED，则合并终态并停止 rewatch。
- 如果 Turn 仍是 PENDING / RUNNING，或 queryChanges 本身也失败，则保持原 turnId，并在固定 1s 延迟后允许重新建立 watcher。
- rewatch 只调用 watchTurn(originalTurnId)，不重新提交 Prompt，不创建新 Turn / USER Message。
- 新 watcher 的 snapshot 替换旧 partial，后续 delta 继续追加。
- rewatch 等待期间允许现有 polling 继续收敛数据库状态。
- watch 生命周期不再依赖 latestSequence 触发重建，避免 polling 更新 sequence 时取消待执行的 rewatch。
- Session / Project 切换会取消当前 watcher 与待执行 retry，不把旧 Turn 的 retry 带到新 Session。
- 本次不修改 SessionService SSE 协议、后端、数据库、Stop 或 GAP-08。

Review Notes:
- GAP-02 snapshot ordering、GAP-03 multi-tab、GAP-04 watcher isolation 均保持不变。

## Purpose

浏览器刷新、页面重开或 SSE 断开后，继续观察同一个活动 Turn，而不是重新提交 Prompt。

## Contract

- Session 重新进入时先查询持久化状态。
- 存在 PENDING / RUNNING Turn 时继续 watch 原 turnId。
- 新 Watcher 先收到当前 Snapshot，再进入后续 Delta。
- Reconnect 不创建 Turn 或 USER Message。
- Watcher 失败时通过 changes 查询继续收敛状态。
- Turn 已终态时恢复最终持久化结果。
- 多 Tab 可以有多个 Watcher，但只能有一个真实 Execution。

## Flow

```text
Session open / reconnect
→ querySession
→ find active turnId
→ watchTurn(turnId)
→ POST /turns/{turnId}/stream
→ snapshot
→ delta
→ terminal

watch failure
→ preserve visible partial
→ queryChanges
→ terminal? converge persisted state
→ still active / changes unavailable? wait 1s
→ rewatch same turnId
```

## Boundary

Owns:
- browser / transport reconnect
- watch existing Turn
- snapshot restoration
- changes fallback

Does Not Own:
- server process recovery
- Stop
- Turn creation
