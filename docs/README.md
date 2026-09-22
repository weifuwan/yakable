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
└── Turn Navigator

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

## 工作方式

以后开发一个能力，默认路径是：

```text
docs/README.md
→ 找到能力域
→ 进入 Capability README
→ 按 README 指定的代码入口工作
→ 更新代码与测试
→ 行为或边界发生变化时同步更新该 README
```

原则：**一块一块写，一块一块验收，再组装。**
