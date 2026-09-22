# Model Selection

## 能力

用户在创建 Project 或发送下一轮 Prompt 前选择本轮模型。

## 用户行为

选择器展示当前可用模型。

用户只切换但没有发送时，不改变持久化默认模型。

一轮 USER Message 正式成立后：

- 当前 Turn 固定本轮 provider / model。
- Session 更新下一轮默认选择。

## 边界

Model Selection 只负责选择和展示。

不负责 Provider HTTP 调用、Token 估算和 Streaming 协议。

## 代码

Frontend：

```text
yakable-ui/src/features/model/catalog.ts
yakable-ui/src/features/model/components/ModelSelector.tsx
yakable-ui/src/features/model/types.ts
```

使用位置：

```text
CreateProjectComposer.tsx
SessionWorkspace.tsx
```

Backend 最终模型身份保存在 Turn，并由 Session 保存下一轮默认值。

## 测试

```text
ModelSelector.test.tsx
CreateProjectComposer.test.tsx
SessionWorkspace.test.tsx
```

保护模型选择、默认恢复以及发送后才持久化的语义。

## 依赖

选择结果交给 [Provider Runtime](../provider-runtime/)。
