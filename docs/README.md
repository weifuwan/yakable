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
