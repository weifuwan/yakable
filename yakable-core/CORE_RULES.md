# Core Rules

Scope:
- `yakable-core/**`

Depends On:
- `/JAVA_RULES.md`
- `/BACKEND_TEST_RULES.md`

Related:
- `yakable-core/src/main/java/io/yakable/core/llm/LLM_DESIGN.md`

Owns:
- Yakable 稳定运行时 Contract
- 与框架无关的内部协议

## Must

- Core 保持纯 Java。
- 只定义上层可以稳定依赖的运行时 Contract。
- Provider / Plugin 适配 Core，而不是反向定义 Core。
- 修改稳定 Contract 时必须考虑 Service 与 Plugin 的影响面。

## Must Not

- 依赖 Spring / Spring Boot。
- 使用 `@Resource` 等容器注解。
- 访问 Controller、数据库或具体 Provider 实现。
- 在 Core 写业务编排。
- 让外部 Provider 协议反向定义内部 Core Contract。

## Tests

确定性的 Contract 行为使用快速测试保护；真实 Provider 网络访问不属于 Core Test。

## Boundary

```text
Service / Boot
    ↓
Core Contract
    ↑
Provider / Plugin Adapter
```
