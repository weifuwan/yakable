# Feature Rules

Scope:

- `yakable-ui/src/features/**`

Depends On:

- `../../FRONTEND_RULES.md`
- `../../TEST_RULES.md`
- 涉及 API 时加载 `../../SERVICE_RULES.md`
- 对应 `docs/capabilities/<domain>/...` Capability Contract

Owns:

- 产品能力 UI
- Feature state
- Feature hooks
- Feature components
- Feature 私有资源

## Must

- 一个 Feature 对应一个真实产品能力 owner。
- 新增或修改 Feature 前先加载对应 Capability Contract。
- Feature 的 UI state、hooks、components 留在 owning feature。
- Feature 私有图片、SVG、字体等资源留在 feature 内。
- Feature 通过 Domain Service 使用后端能力。
- 页面只组合 Feature，不把 Feature 业务状态搬到 Page。
- 一个新能力一次只推进一个明确 Feature / Capability 边界。
- 产品语义、快捷键语义、模式标签等留在 owning Feature。

## Must Not

- 为未来 Agent、Planning、Generated Files、Editor、Preview 等能力提前建空模块。
- 在 Feature 直接调用 `fetch`。
- 在 Feature 重复定义 Service 已拥有的 API Contract 类型。
- 因为“可能复用”就把一次性组件提前提升到 Shared。
- 把 Shared UI 变成 Feature 业务层。
- 在 Feature 伪造后端业务结果。

## Current Ownership

当前已实现 owner 包括：

- `project`：Project 查询、Dashboard Project 交互。
- `model`：Model identity 与选择 UI。
- `session`：Conversation / Session workspace 与消息交互。
- `auth`：登录、Profile 与认证交互。
- `user-management`：用户管理 UI。

目录名以当前代码为准；产品语义以对应 Capability Contract 为准。

## Tests

Feature 用户行为遵循 `TEST_RULES.md`，优先通过 Feature 公共组件 / Hook 的可观察行为验证。

## Boundary

Feature 拥有产品能力前端实现；API 协议属于 Service；跨 Feature 无业务 owner 的能力才进入 Shared。
