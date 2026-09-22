# Capabilities

Capability 是 Yakable 的实际施工单元。

一个 Capability 必须足够独立，使人或 AI 不扫描整个仓库也能回答：

```text
它解决什么问题？
用户怎么使用？
它不负责什么？
调用链是什么？
代码从哪里开始读？
改动应该落在哪里？
要保护哪些测试？
它和哪些能力组装？
```

推荐结构保持简单：

```text
# Capability

## 能力
## 用户行为
## 边界
## 流程
## 代码
## 测试
## 依赖
```

不是每个小按钮都要成为 Capability。

只有当一块逻辑能够独立理解、实现和验收时，才单独拆出来。

当前能力域：

- [Project](./project/)
- [Conversation](./conversation/)
- [User](./user/)
- [Model](./model/)
