# Send Message

## 能力

用户在当前 Session 中提交一条新的 Prompt，建立一个新的 Turn 和 USER Message。

## 用户行为

```text
输入 Prompt
→ Send / Enter
→ User Message 立即反馈
→ USER Message 持久化后本轮正式成立
→ 输入框清空
→ 进入 Thinking / Streaming
```

如果 USER Message 成立前请求失败，原 Prompt 保留，可安全重试。

## 边界

负责：

- Prompt 提交。
- requestId。
- Turn 创建。
- USER Message 持久化。
- 本轮 provider / model 固定。
- Session activity 更新。
- optimistic → persisted 收敛。

不负责：

- Assistant Delta。
- Stop。
- 历史分页。
- Context 选择。

## 流程

```text
SessionWorkspace.handleSubmit
→ SessionService.streamingTurn()
→ POST /turns/stream
→ SessionController.streamingTurn()
→ SessionService.addStreamingTurn()
→ TurnService + MessageService
→ USER Message persisted
→ SSE started
→ frontend clears composer
→ executeTurnAsync()
```

## 代码

Frontend：

```text
yakable-ui/src/features/session/components/SessionWorkspace.tsx
yakable-ui/src/service/session/SessionService.ts
```

Backend：

```text
SessionController.streamingTurn()
SessionService.addStreamingTurn()
SessionServiceImpl
TurnService
MessageService
```

DAO：

```text
SessionRepository
TurnRepository
MessageRepository
```

## 测试

保护：

- optimistic USER Message。
- started 后才清空 Prompt。
- started 前失败保留 Prompt。
- requestId 重试不重复 Turn / USER Message。
- 同一 Session 不产生并发 active Turn。

## 依赖

依赖 [Model Selection](../../model/selection/)。

成功建立 Turn 后进入 [Streaming](../streaming/)。
