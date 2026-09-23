# Streaming

Status: Review
Domain: Conversation

Depends On:
- [Send Message](./send-message.md)
- [Provider Runtime](../model/provider-runtime.md)

Related:
- [Stop](./stop.md)
- [Reconnect](./reconnect.md)
- [Recovery](./recovery.md)
- [History](./history.md)

Frontend:
- `yakable-ui/src/features/session/components/SessionWorkspace.tsx`
- `yakable-ui/src/features/session/components/MessageItem.tsx`
- `yakable-ui/src/service/session/SessionService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`
- `yakable-core/src/main/java/io/yakable/core/conversation/stream/TurnStreamRuntime.java`
- `yakable-core/src/main/java/io/yakable/core/conversation/stream/TurnStreamListener.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmClient.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmStreamEvent.java`

Data:
- Turn
- Message
- Stream State

Shared Rules:
- CONV-001
- CONV-004
- CONV-005
- CONV-006
- CONV-009
- CONV-012
- CONV-013
- CONV-015
- CONV-016
- CONV-018
- CONV-019
- CONV-020
- CONV-021

Scenarios:
- CONV-S01
- CONV-S02
- CONV-S03
- CONV-S04
- CONV-S05
- CONV-S06
- CONV-S07
- CONV-S08
- CONV-S09

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/service/session/__tests__/SessionService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`
- `yakable-core/src/test/java/io/yakable/core/conversation/stream/TurnStreamRuntimeTest.java`

Review Notes:
- Stream Runtime ownership 已迁移到 Core；SessionServiceImpl 只保留 Turn 业务状态、事务、持久化和 Runtime 协作。
- GAP-06 已实现：Core TurnStreamRuntime 内部 TurnStreamState 增加 Stop cutover，并与 delta() 共用同一个 eventLock。
- beginStopCutover() 在 eventLock 内一次性冻结后续 delta 并返回 cutover snapshot；cutover 后的 delta 不进入 content，也不进入 watcher mailbox。
- 如果 delta 先获得 eventLock，它会先进入 content，随后 Stop snapshot 必然包含该 delta；如果 Stop 先获得 eventLock，后续 delta 必然被拒绝。
- Stop transaction 失败或未更新终态时会 cancelStopCutover()，恢复 delta 接收。
- 并发 Stop 使用 cutover 计数，单个失败 Stop 不会误释放另一个仍有效的 cutover。
- 已新增竞态回归测试与 rollback 回归测试。
- GAP-02 / GAP-03 / GAP-04 的顺序、multi-watcher 和 watcher isolation 实现未修改。
- 当前执行环境无法解析 github.com，目标 Maven 测试尚未实际执行；测试通过前保持 Review。

## Purpose

Assistant 内容生成一部分就展示一部分，不等待完整回答。

## Contract

- Turn Execution 不依赖某一个 SSE Watcher 存活。
- 新 Watcher 观察活动 Turn 时先得到当前 Snapshot，再接收后续 Delta。
- terminal 发布前，应该持久化的 Assistant 内容必须先完成持久化。
- Stop / Failure 时非空 partial Assistant 保留。
- 用户阅读历史时，Streaming 继续执行但不能强制抢回阅读位置。
- 用户阅读历史时，Streaming 仍推进 Turn 状态与 Session latest sequence；除非 Streaming Turn 已在当前窗口，否则其新 Message 不注入历史 Message Window。
- 用户从历史位置发送新 Prompt 时切回 follow-latest；Optimistic USER Message 与正式 USER Message 必须 reconcile 为单一 Turn 节点。
- Stream Buffer 有明确大小边界。
- 当前 Stream State 是 JVM 本地状态。

## Flow

```text
executeTurnAsync
→ claim PENDING
→ LlmClient.streamingChat
→ LlmProvider
→ LlmStreamEvent
→ TurnStreamRuntime
→ watcher
→ SSE
→ SessionService.ts
→ SessionWorkspace
```

## Boundary

Owns:
- runtime Assistant buffer
- snapshot / delta / terminal events
- watcher notification
- frontend streaming rendering

Does Not Own:
- Turn creation
- business Stop decision
- reconnect policy
- server recovery
