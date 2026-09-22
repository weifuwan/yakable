# Shared Lib Rules

Scope:
- `yakable-ui/src/shared/lib/**`

Depends On:
- `../../../FRONTEND_RULES.md`
- 行为需要回归时加载 `../../../TEST_RULES.md`

Owns:
- 与产品 Feature 无关的纯工具
- 浏览器通用 helper
- 框架无关 helper

## Must

- 只有没有明确产品 Feature owner 的通用 helper 才进入 shared/lib。
- 优先保持纯函数和明确输入输出。
- 格式化、集合处理、浏览器通用逻辑等稳定能力可在这里复用。
- 新增 helper 前先搜索已有实现。

## Must Not

- 引入 Project、Session、Model、Agent 等产品语义。
- 放 HTTP、SSE、Request Error、API cancellation 等传输能力。
- 为一次性调用提前抽公共 helper。
- 包装浏览器 / 标准库已经清晰提供的能力。
- 建立第二套状态管理、请求或事件基础设施。

## Tests

纯工具只在存在稳定、非平凡输入输出时补测试。

## Boundary

shared/lib 是无业务 owner 的通用代码；传输属于 `src/service`，产品逻辑属于 Feature。
