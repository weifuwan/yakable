# Core Rules

Scope:
- `yakable-core/**`

Depends On:
- `/ARCHITECTURE.md`
- `/JAVA_RULES.md`
- `/BACKEND_TEST_RULES.md`

Related:
- `yakable-core/src/main/java/io/yakable/core/llm/LLM_DESIGN.md`

Owns:
- Yakable 稳定核心能力
- 稳定 Runtime Contract
- 有独立生命周期的 Runtime State / State Machine
- Core 级并发、资源边界与生命周期机制

## Must

- 一个能力进入 Core 前必须有真实、稳定的 Runtime ownership，不能只因为 Service 文件过长。
- Core Contract 保持 Provider / Transport / Persistence implementation 无关。
- Spring 可以用于 Core capability 自身需要的依赖注入、配置或生命周期管理；Spring 是否存在不决定 ownership。
- Core 暴露的稳定 Contract 避免泄漏 Controller、HTTP、Repository、Entity 或具体 Provider 实现类型。
- Provider / Plugin 适配 Core，而不是反向定义 Core。
- 修改稳定 Contract 时必须考虑 Service 与 Plugin 的影响面。
- Runtime 中可增长的内存状态、队列、Watcher 或并发资源必须有明确边界或释放条件。

## Must Not

- 依赖 `yakable-service`、`yakable-dao`、`yakable-boot` 或具体 Provider Plugin 实现。
- 访问 Controller、HTTP / SSE transport、Repository、Mapper、Entity 或数据库。
- 在 Core 决定 Session / Turn / Message 等持久化业务事实。
- 在 Core 打开业务数据库事务或承担 persistence-facing workflow。
- 把业务编排搬进 Core 只为了给 Service 减少代码行数。
- 为了架构对称新增没有真实生命周期或 Contract 的 Manager / Coordinator / Handler / Adapter。
- 让外部 Provider 协议反向定义内部 Core Contract。

## Tests

- 确定性的 Contract、状态机、并发边界和 Runtime invariant 使用快速测试保护。
- Core Test 不访问真实数据库、HTTP Controller 或第三方 Provider 网络。
- 跨 Service / Core 的业务 Scenario 继续由所属 Service / Integration Test 保护，不因 Core 增加单测而删除。

## Boundary

```text
Service ─────→ Core ←───── Plugins
                 │
                 ↓
              Common

Boot assembles Service / Plugins and owns transport.
```

Core 拥有稳定 Runtime mechanism；Service 拥有业务事实与业务编排。
