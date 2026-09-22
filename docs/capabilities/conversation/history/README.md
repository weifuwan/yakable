# History

## 能力

稳定展示当前 Session 的历史 Message，并按需加载更早内容。

## 用户行为

```text
enter Session
→ show latest messages
→ scroll upward
→ load older messages
→ keep reading position
```

当前 V1 首次只加载最近 50 条 Message，不一次加载整个 Session。

## 边界

负责：

- Message 展示顺序。
- 最近一页。
- 向上历史分页。
- 增量 Message 收敛。
- 加载历史后保持阅读位置。

不负责：

- LLM Context 选择。
- Turn Navigator 全量索引。
- 搜索。

## 流程

```text
SessionWorkspace
→ querySession()
→ latest Message window

scroll near top
→ queryMessages(beforeSequence, 50)
→ prepend
→ compensate scrollHeight
```

Streaming / Stop / Failure 产生的最终持久化 Message 通过 snapshot / changes 收敛到历史。

## 代码

Frontend：

```text
SessionWorkspace.tsx
MessageItem.tsx
SessionService.queryMessages()
SessionService.queryChanges()
```

Backend：

```text
SessionController.querySession()
SessionController.querySessionMessages()
SessionController.querySessionChanges()
SessionService
MessageService
```

DAO：

```text
MessageRepository
MessageMapper
MessageEntity
```

## 测试

保护：

- latest 50。
- beforeSequence 分页。
- prepend 不重复。
- prepend 后阅读位置稳定。
- Session 切换不显示旧历史。

## 依赖

展示数据来自 Turn / Message。

和 [Context](../context/) 完全分离。
