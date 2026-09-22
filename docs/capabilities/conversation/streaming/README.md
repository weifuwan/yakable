# Streaming

## 能力

Assistant 内容生成一部分就展示一部分，不等待完整回答。

## 用户行为

```text
Turn established
→ Thinking
→ first delta
→ Assistant Streaming
→ complete / failed / stopped
```

用户阅读历史时，Streaming 可以继续，但不能强制抢回阅读位置。

## 边界

负责：

- 服务端实时 Assistant Buffer。
- SSE watcher。
- snapshot。
- delta。
- terminal event。
- 前端 streaming content 展示。

不负责：

- Turn 创建。
- Stop 的业务决定。
- 浏览器重连策略。
- 服务异常 Recovery。

## 流程

```text
SessionService.executeTurnAsync
→ claim PENDING
→ LlmClient.streamingChat
→ LlmProvider
→ delta
→ TurnStreamState
→ watcher
→ SessionController SSE
→ frontend SessionService
→ SessionWorkspace
```

终态前先持久化需要保留的 Assistant 内容，再发布 terminal。

## 代码

Frontend：

```text
yakable-ui/src/service/session/SessionService.ts
yakable-ui/src/features/session/components/SessionWorkspace.tsx
yakable-ui/src/features/session/components/MessageItem.tsx
```

Backend：

```text
SessionController
SessionServiceImpl
TurnStreamListener
yakable-core/.../LlmClient.java
yakable-core/.../LlmStreamEvent.java
```

当前 Stream State 在 JVM 内，因此 SaaS V1 是单实例运行边界。

## 测试

保护：

- Thinking → first delta。
- snapshot + delta 顺序。
- complete / failed / stopped。
- partial content。
- watcher 断开不等于 Stop。
- Streaming Buffer 有大小边界。

## 依赖

由 [Send Message](../send-message/) 建立 Turn。

被 [Stop](../stop/) 和 [Reconnect](../reconnect/) 使用。
