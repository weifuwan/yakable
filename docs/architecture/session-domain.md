# Session Domain

当前数据关系：

```text
Project
  └── Session
       └── Turn
            └── Message
```

## Session

Session 保存一次会话的模型配置和状态。

## Turn

Turn 表示一次用户输入对应的执行。

状态：

```text
PENDING -> RUNNING -> SUCCEEDED
                    -> FAILED

RUNNING --recovery--> PENDING
```

同一个 Session 同一时间只允许一个 PENDING / RUNNING Turn。

## Message

Message 是会话消息记录，通过 `message_sequence` 保证顺序。

## 创建 Turn

```text
SessionService
  -> lock Session
  -> 检查 active Turn
  -> insert PENDING Turn
  -> insert USER Message
  -> commit
  -> TurnDispatcher
```

## 执行 Turn

```text
TurnExecutor
  -> claim PENDING
  -> build context
  -> ModelClient
  -> persist SUCCEEDED / FAILED
```

模型调用不放在数据库事务中。

## 恢复

`TurnRecoveryWorker` 定期把超时的 RUNNING Turn 恢复为 PENDING，并重新调度。

## Context

模型上下文只包含：

```text
之前 SUCCEEDED Turn 的 Messages
+
当前 Turn 的 Messages
```

FAILED Turn 保留在数据库中，但默认不进入后续模型上下文。

## 当前原则

这套结构先保持简单。

以后只有出现真实需求时，再增加分布式 lease、MQ、重试策略、SSE、Tool Call 等能力。
