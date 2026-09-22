# Yakable 文档

这是 Yakable 文档的唯一入口。

```text
PRD
 ↓
UX / Interaction Spec
 ↓
Technical Design
 ↓
Implementation Plan
 ↓
Feature Implementation Spec
 ↓
Code / Test / Acceptance
```

## 文档目录

- [prd/](./prd/)：产品需求与业务规则。
- [ux/](./ux/)：页面布局、状态和交互。
- [design/](./design/)：整体技术设计。
- [plans/](./plans/)：实现顺序与 PR 拆分。
- [implementation/](./implementation/)：单个功能的详细实现方案。
- [decisions/](./decisions/)：重要技术决策记录。

## MVP 流程示例

用 Session 的“回到最新位置”验证整套文档流：

```text
Session PRD
  ↓
Scroll to Latest UX
  ↓
Scroll to Latest Technical Design
  ↓
Scroll to Latest Implementation Plan
  ↓
Scroll to Latest Feature Implementation Spec
  ↓
Regression Test / Acceptance
```

- PRD：[`prd/session/session-v1.md`](./prd/session/session-v1.md)
- UX：[`ux/session/scroll-to-latest-v1.md`](./ux/session/scroll-to-latest-v1.md)
- Design：[`design/session/scroll-to-latest-v1.md`](./design/session/scroll-to-latest-v1.md)
- Plan：[`plans/session/scroll-to-latest-v1.md`](./plans/session/scroll-to-latest-v1.md)
- Implementation：[`implementation/session/scroll-to-latest-v1.md`](./implementation/session/scroll-to-latest-v1.md)

这个例子故意保持很小：已有 PRD 就复用，已有正确实现就不重写，只补缺失的设计层和回归保护。

## 工程规范

代码规范仍放在最接近代码的位置，由这里统一进入：

- [Java 全局规范](../JAVA_GLOBAL_CODE_README.md)
- [后端测试规范](../BACKEND_TEST_README.md)
- [Service 规范](../yakable-service/SERVICE_README.md)
- [Core 规范](../yakable-core/CORE_README.md)
- [Common 规范](../yakable-common/COMMON_CODE.md)
- [Entity 规范](../yakable-dao/ENTITY_README.md)
- [Repository / Mapper 规范](../yakable-dao/REPOSITORY_README.md)
- [Flyway 规范](../yakable-dao/FLYWAY_README.md)

原则：**所有文档从这里进入；一份文档只回答自己这一层的问题。**
