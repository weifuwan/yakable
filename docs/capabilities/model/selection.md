# Model Selection

Status: Done
Domain: Model

Depends On:
- [Provider Runtime](./provider-runtime.md)

Related:
- [Provider Runtime](./provider-runtime.md)
- [Send Message](../conversation/send-message.md)
- [Create Project](../project/create.md)

Frontend:
- `yakable-ui/src/features/model/catalog.ts`
- `yakable-ui/src/features/model/components/ModelSelector.tsx`
- `yakable-ui/src/features/model/types.ts`
- `yakable-ui/src/features/project/components/CreateProjectComposer.tsx`
- `yakable-ui/src/features/session/components/SessionWorkspace.tsx`

Backend:
- Turn / Session model identity handled by existing Project / Conversation services

Data:
- provider
- model
- Turn model identity
- Session next-turn default

Shared Rules:
- MODEL-001
- MODEL-002
- MODEL-003

Scenarios:
- MODEL-S01

Tests:
- `yakable-ui/src/features/model/components/__tests__/ModelSelector.test.tsx`
- `yakable-ui/src/features/project/components/__tests__/CreateProjectComposer.test.tsx`
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`

## Purpose

在创建 Project 或发送下一轮 Prompt 前选择本轮模型。

## Contract

- UI 只展示当前运行时真实支持的模型。
- 用户仅切换选择但没有发送时，不改变已持久化的 Turn。
- 一轮正式成立时，Turn 固定 provider / model。
- Session 保存的模型只作为下一轮默认值。
- 恢复 / Recovery 使用 Turn 自己的模型身份，不重新读取 Session 默认值。

## Flow

```text
ModelSelector
→ selected provider / model
→ Create Project or Send Message
→ Turn established
→ persist Turn model identity
→ Session default updated for next turn
```

## Boundary

Owns:
- model catalog presentation
- user model choice
- next-turn default selection

Does Not Own:
- provider HTTP call
- token estimation
- context budget
