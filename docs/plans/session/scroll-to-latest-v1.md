# Scroll to Latest Implementation Plan V1

> PRD：复用 `docs/prd/session/session-v1.md`  
> UX：`docs/ux/session/scroll-to-latest-v1.md`  
> Design：`docs/design/session/scroll-to-latest-v1.md`

## 1. 为什么只需要一个 PR

这是一个小型前端交互。

不涉及 Backend、数据库、API 或新的领域模型，因此不拆成多个 PR。

## 2. 施工顺序

### Step 1：确认现有行为

检查 `SessionWorkspace`：

- Bottom 判断。
- Follow Output。
- 按钮显示。
- Streaming 更新。
- 历史加载。

如果当前实现已经满足 Design，不为了“重新实现”而重构。

### Step 2：补回归测试

在：

```text
yakable-ui/src/features/session/components/__tests__/
SessionWorkspace.test.tsx
```

补：

- leave latest → button visible → click → latest。
- reading history + Streaming → 不自动回底部。

### Step 3：验收

对照 UX 验收项检查。

运行前端现有检查命令，不新增测试框架。

## 3. 本次不做

- Smooth scroll。
- 新的动画。
- 抽取 Scroll Hook。
- Turn Navigator。
- Backend 修改。
- 重新设计 Prompt Composer。
