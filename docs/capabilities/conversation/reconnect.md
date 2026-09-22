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

Scenarios:
- CONV-S03
- CONV-S04
- CONV-S08

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/service/session/__tests__/SessionService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`

Known Gaps:
- 当前没有覆盖“两个 Tab 同时 watch 同一 Turn、其中一个 Tab Stop、两个 Tab 收敛到 STOPPED”的完整回归测试（GAP-03，本 PR 不处理）。

Implementation Design:
- Reconnect 不新增自己的排序机制，继续依赖 Streaming 的 TurnStreamState。
- Streaming 必须保证新 watcher 的可观察顺序为 snapshot → future delta → terminal。
- 本次只修 watcher handoff ordering，不修改 reconnect API、changes fallback 或 multi-tab 语义。

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
→ queryChanges
→ converge persisted state
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
