# Model Domain

## Graph

```text
Model Selection
      ↓
provider + model fixed on Turn
      ↓
Provider Runtime
      ↓
LLM
```

Capabilities:

- [Model Selection](./selection.md)
- [Provider Runtime](./provider-runtime.md)

## Shared Rules

### MODEL-001 — Supported Models Only

产品界面只能暴露当前运行时真实支持的模型。

### MODEL-002 — Turn Model Identity

Turn 一旦成立，本轮 provider / model 不再变化。

### MODEL-003 — Session Default

Session 上的 provider / model 只表示下一轮默认选择，不反向修改已成立 Turn。

### MODEL-004 — Stable Contract

业务 Service 只依赖稳定 LLM Contract，不能写具体 Provider 特例。

### MODEL-005 — Model Metadata

受支持模型必须提供 Context Window / Token 估算所需的稳定 Metadata。

### MODEL-006 — Plugin Isolation

Provider 鉴权、HTTP 协议和协议差异留在 Model Plugin。

## Cross-Capability Scenarios

### MODEL-S01 — Select → Send → Execute

Involves:
- Model Selection
- Conversation / Send Message
- Provider Runtime

Guarantees:
- 用户发送时确定本轮模型。
- Turn 保存固定模型身份。
- Provider Runtime 使用 Turn 身份执行。

### MODEL-S02 — Context Budget

Involves:
- Provider Runtime
- Conversation / Context

Guarantees:
- Context 使用当前 Turn 的模型 Metadata。
- 模型输入边界明确，不使用猜测值。
