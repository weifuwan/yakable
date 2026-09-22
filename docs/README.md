# Yakable Docs

这是 Yakable 的唯一文档入口。

这些文档首先服务于 **Context 定位**，不是为了完成传统研发流程中的文档交付。

目标只有一个：

> 人或 AI 接到一个任务后，能够快速知道它属于哪里、受什么规则约束、会影响谁、应该读哪些代码和测试。

## Knowledge Map

```text
Product
  → 稳定产品事实

Domain Contract
  → Shared Rules
  → Cross-Capability Scenarios

Capability Manifest
  → Depends On / Related
  → Code / Data / Tests
  → Contract / Flow / Boundary

Decision
  → 少量长期技术取舍
```

当前：

- [Product](./product/)
- [Capabilities](./capabilities/)
- [Decisions](./decisions/)

## Context Loading

收到开发任务后，不默认扫描整个仓库。

固定读取顺序：

```text
Task
→ 识别 Domain + Capability
→ 读取 Domain README
→ 读取目标 Capability
→ 加载 Depends On
→ 根据 Shared Rules / Scenarios 找到关联能力
→ 只加载 Manifest 指定的 Code / Data / Tests
→ 开始设计
```

`Related` 不是默认全部加载；只有任务实际触及对应场景或共享规则时才继续扩展。

## Document Rules

### 规则只写一次

跨多个能力成立的规则必须放在 Domain README，并分配稳定 ID。

例如：

```text
CONV-006
Refresh / disconnect 不得触发 STOPPED。
```

Capability 只引用：

```text
Shared Rules:
- CONV-006
```

禁止在多个 Capability 中复制同一条规则正文。

### 交叉行为写 Scenario

一个行为同时涉及多个 Capability 时，不强行归给其中一个。

放到 Domain README：

```text
CONV-S03
Streaming → Refresh → Reconnect → Continue
```

Scenario 明确：

- 涉及哪些 Capability。
- 必须保证什么结果。

这样修改一个能力时，可以通过 Scenario 找到需要一起 Review 的影响面。

### 第一屏必须能路由 Context

Capability 文件开头必须先写 Context Manifest：

```text
Status
Domain
Depends On
Related
Frontend
Backend
Data
Shared Rules
Scenarios
Tests
```

AI 不需要先读长篇背景，第一屏就应该知道下一步读什么。

### 正文只保留高密度信息

Capability 正文默认只有：

```text
Purpose
Contract
Flow
Boundary
```

已经能从 Manifest 得到的信息，不在正文重复。

普通 Capability 应尽量保持简短；如果一份 Capability 持续膨胀，优先检查它是不是应该继续拆分。

## Status

统一使用：

```text
Planned       尚未设计
Designing     正在设计，代码可能不存在
Implementing  正在开发
Review        开发完成，正在 Review
Done          文档描述当前真实实现
```

`Done` 文档必须和当前代码一致。

`Designing` / `Implementing` 文档必须明确哪些路径是计划落点，不能让 AI 把未来设计当成当前实现。

## Feature Development Rule

新增功能必须串行推进，一次只做一个 Capability 或一个已经明确拆分好的功能块。

固定流程：

```text
选择一个功能
→ 读取当前 Domain / Capability / Code / Tests
→ 识别真实 Gap
→ 先更新 Capability 设计
→ 开发最小实现
→ 执行对应测试
→ 按 Capability + Shared Rules + Scenarios Review
→ 修复 Review Gap
→ 将 Status 更新为 Done
→ 才能进入下一个功能
```

禁止：

- 一个 PR 同时新增多个独立功能。
- 当前功能未 Review 完就开始下一个。
- 不看当前代码直接重新设计一套结构。
- 为未来需求提前实现代码。
- 为了“架构完整”随意新增 Manager / Coordinator / Handler / Assembler。
- 让代码改动超出当前 Capability 的边界。

设计变更时，先更新文档，再继续开发。

## Engineering Rules

代码规范仍放在离代码最近的位置：

- [Java 全局规范](../JAVA_GLOBAL_CODE_README.md)
- [后端测试规范](../BACKEND_TEST_README.md)
- [Service 规范](../yakable-service/SERVICE_README.md)
- [Core 规范](../yakable-core/CORE_README.md)
- [Common 规范](../yakable-common/COMMON_CODE.md)
- [Entity 规范](../yakable-dao/ENTITY_README.md)
- [Repository / Mapper 规范](../yakable-dao/REPOSITORY_README.md)
- [Flyway 规范](../yakable-dao/FLYWAY_README.md)

原则：

> **把稳定事实写成 Contract，把共享约束写成 Rule，把交叉行为写成 Scenario，把代码入口写进 Manifest。**
