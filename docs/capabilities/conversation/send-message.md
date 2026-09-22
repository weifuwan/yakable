# Send Message

Status: Done
Domain: Conversation

Depends On:
- [Model Selection](../model/selection.md)

Related:
- [Streaming](./streaming.md)
- [History](./history.md)
- [Recent Projects](../project/recent-projects.md)

Frontend:
- `yakable-ui/src/features/session/components/SessionWorkspace.tsx`
- `yakable-ui/src/service/session/SessionService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- `yakable-service/src/main/java/io/yakable/service/session/SessionService.java`
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`
- `yakable-service/src/main/java/io/yakable/service/turn/TurnService.java`
- `yakable-service/src/main/java/io/yakable/service/message/MessageService.java`

Data:
- Session
- Turn
- Message

Shared Rules:
- CONV-001
- CONV-002
- CONV-003
- CONV-004
- CONV-011
- CONV-012
- CONV-015

Scenarios:
- CONV-S01

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/service/session/__tests__/SessionService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`

## Purpose

在当前 Session 中提交一条 Prompt，建立一个新的 Turn 和 USER Message。

## Contract

- 客户端为一次逻辑提交生成稳定 requestId。
- USER Message 持久化后本轮才成立。
- Turn 成立时固定 provider / model。
- 同一 Session 不能并发建立第二个 active Turn。
- USER Message 成立前失败时，前端保留 Prompt 供安全重试。
- USER Message 成立后，后续 AI Failure 不能回滚本轮。
- 新 USER Message 成立后更新 Session / Project activity。

## Flow

```text
SessionWorkspace.handleSubmit
→ optimistic USER message
→ SessionService.streamingTurn
→ POST /turns/stream
→ SessionController
→ SessionService.addStreamingTurn
→ Turn + USER Message transaction
→ SSE started
→ clear composer
→ executeTurnAsync
```

## Boundary

Owns:
- Prompt submission
- requestId
- Turn establishment
- USER Message persistence
- model identity for the Turn

Does Not Own:
- Assistant Delta
- Stop
- History paging
- Context selection
