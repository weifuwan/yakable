# Model

Model 域把“用户选择哪个模型”和“后端怎么真正调用 Provider”分开。

```text
Model Selection
      ↓
provider + model fixed on Turn
      ↓
Provider Runtime
      ↓
LLM
```

当前能力：

- [Model Selection](./selection/)
- [Provider Runtime](./provider-runtime/)

原则：产品界面只能暴露当前运行时真实支持的模型。
