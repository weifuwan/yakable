# Yakable Docs

这是 Yakable 文档的唯一入口。

文档不再按 PRD / UX / Design / Plan 分散组织，而是围绕“产品”和“能力块”组织。

```text
Yakable
├── Product
│   ├── Project
│   ├── Session
│   ├── User
│   └── Frontend Domain Harness
│
├── Capabilities
│   ├── Project
│   ├── Conversation
│   ├── User
│   └── Model
│
└── Decisions
```

## Product

[product/](./product/) 只回答稳定的产品语义：它是什么、用户为什么需要、边界在哪里。

## Capabilities

[capabilities/](./capabilities/) 是日常开发的主要入口。

一个能力块就是一个可以独立理解、独立实现、独立测试、再组装进系统的工作单元。

每个能力 README 都回答：

```text
这块干嘛
用户怎么用
边界是什么
流程怎么走
Frontend 在哪
Backend 在哪
DAO 在哪
测试在哪
依赖谁 / 被谁依赖
```

### 当前能力地图

```text
Project
├── Create Project
└── Recent Projects

Conversation
├── Send Message
├── Streaming
├── Stop
├── Reconnect
├── Recovery
├── History
├── Context
└── Turn Navigator (Draft)

User
├── Authentication
└── User Management

Model
├── Model Selection
└── Provider Runtime
```

## Decisions

[decisions/](./decisions/) 只记录少量重要且有长期影响的技术取舍。

普通实现细节直接写在对应 Capability README，不单独制造设计文档。

## Engineering Rules

工程规范仍放在最接近代码的位置：

- [Java 全局规范](../JAVA_GLOBAL_CODE_README.md)
- [后端测试规范](../BACKEND_TEST_README.md)
- [Service 规范](../yakable-service/SERVICE_README.md)
- [Core 规范](../yakable-core/CORE_README.md)
- [Common 规范](../yakable-common/COMMON_CODE.md)
- [Entity 规范](../yakable-dao/ENTITY_README.md)
- [Repository / Mapper 规范](../yakable-dao/REPOSITORY_README.md)
- [Flyway 规范](../yakable-dao/FLYWAY_README.md)

## 新增功能规范

新增功能必须串行推进，不能一次性新增多个功能。

### 一次只做一个功能

一个开发周期只允许新增一个 Capability，或者只解决一个已经明确拆分好的功能块。

禁止：

- 一个 PR 同时新增多个互相独立的功能。
- 做当前功能时顺手把“以后可能需要”的功能一起加进去。
- 当前功能还没有 Review 完成，就继续进入下一个功能。

功能过大时，先拆成多个可以独立理解、实现和验收的块，再一块一块完成。

### 先看当前代码

新增或修改功能前，必须先理解当前实现。

默认阅读顺序：

```text
docs/README.md
→ 对应 Capability README
→ README 指定的 Frontend / Backend / DAO / Test 入口
→ 当前真实调用链
```

必须先确认：

- 当前代码已经怎么设计。
- 现有职责边界在哪里。
- 哪些代码可以直接复用。
- 当前测试保护了什么。
- 新功能真正缺少的是什么。

禁止脱离现有代码重新想一套结构，也不能因为新写一个类更方便，就随意新增 Manager / Coordinator / Handler / Assembler 等中间层。

### 先设计，再开发

写代码前，先完成对应 Capability 的设计。

新增 Capability 就先创建它的 README；已有 Capability 就先更新现有 README。

设计至少要明确：

```text
功能解决什么问题
用户怎么使用
这块负责什么 / 不负责什么
完整流程怎么走
Frontend 放在哪里
Backend 放在哪里
DAO 是否需要变化
计划修改 / 新增哪些文件
异常和边界怎么处理
需要保护哪些测试
和哪些能力组装
```

设计没有明确到代码落点之前，不进入开发。

开发过程中如果发现设计需要变化，先更新 README，再继续改代码。

### 按设计最小实现

开发只实现当前设计已经定义的内容。

要求：

- 优先复用现有结构。
- 不做无关重构。
- 不提前实现下一个功能。
- 不为了“架构完整”增加当前不需要的抽象。
- 不让代码范围超过 Capability README 定义的边界。

### 开发完成后必须 Review

代码完成后，不直接开始下一个功能。

必须重新对照 Capability README Review 当前实现：

```text
设计
→ 当前代码
→ 是否一致
→ 是否缺失
→ 是否过度实现
→ 是否破坏已有边界
→ 测试是否覆盖关键行为
→ 必要修复
→ 完成
```

Review 完成并关闭本功能后，才能进入下一个功能。

## 工作方式

以后开发一个能力，固定流程是：

```text
选择一个功能
→ 阅读当前实现
→ 设计 Capability
→ 开发
→ 测试
→ Review
→ 修复 Review 问题
→ 完成本功能
→ 再选择下一个功能
```

原则：**一次一个功能，先理解，先设计，再开发，再 Review，最后组装。**
