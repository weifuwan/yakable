# Yakable 文档体系

Yakable 文档按“产品 → 交互 → 技术 → 施工 → 具体实现”分层，避免把需求、设计和代码方案混在同一份文档中。

```text
PRD
 ↓
UX Spec
 ↓
Technical Design
 ↓
Implementation Plan
 ↓
Feature Implementation Spec
 ↓
Code / Test / Acceptance
```

目录：

- `prd/`：产品需求与业务规则。
- `ux/`：页面布局、状态和交互。
- `design/`：整体技术设计。
- `plans/`：实现顺序与 PR 拆分。
- `implementation/`：单个功能的详细实现方案。
- `decisions/`：重要技术决策记录。
- `quality/`：跨功能的质量与工程底线。

原则：**一份文档只回答自己这一层的问题，不跨层代替下一层设计。**
