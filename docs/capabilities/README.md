# Capabilities

Capability 是 Yakable 的最小施工与 Context 单元。

目录代表 Domain，文件代表 Capability：

```text
capabilities/
├── project/
│   ├── README.md
│   ├── create.md
│   └── recent-projects.md
├── conversation/
├── user/
└── model/
```

## Capability Manifest

所有 Capability 第一屏统一使用：

```text
# Capability

Status:
Domain:

Depends On:
- ...

Related:
- ...

Frontend:
- ...

Backend:
- ...

Data:
- ...

Shared Rules:
- ...

Scenarios:
- ...

Tests:
- ...

Known Gaps:
- ...
```

字段含义：

- `Depends On`：没有这些能力，本能力不能成立。默认加载。
- `Related`：存在影响关系，但不是每次都需要加载。
- `Frontend / Backend`：当前真实代码入口；尚未实现时必须标注 Planned。
- `Data`：涉及的稳定数据概念。
- `Shared Rules`：必须遵守的 Domain Rule ID。
- `Scenarios`：修改本能力时必须一起 Review 的组合场景。
- `Tests`：最小回归入口。
- `Known Gaps`：仅在 `Review` / `Implementing` 等未完成状态下使用，明确当前文档与真实代码之间尚未闭合的 Gap。

## Body

Manifest 后正文默认只写：

```text
## Purpose
## Contract
## Flow
## Boundary
```

不要重复 Manifest 已经表达的路径和依赖。

## Context Expansion

AI 修改 Capability 时：

1. 先读 Domain README。
2. 再读目标 Capability。
3. 默认加载 Depends On。
4. 通过 Shared Rules / Scenarios 判断 Related 是否需要进入 Context。
5. 只加载 Manifest 指定的代码和测试。
6. 如果证据仍不足，再继续扩展。

## Current Domains

- [Project](./project/)
- [Conversation](./conversation/)
- [User](./user/)
- [Model](./model/)

新增 Capability 前必须遵守 [Feature Development Rule](../README.md#feature-development-rule)。
