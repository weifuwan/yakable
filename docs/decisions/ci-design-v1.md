# Yakable CI Design V1

Status: Designing

## Purpose

Yakable CI 不是流程装饰。

它只负责为两件事提供可重复、可绑定 Commit SHA 的 Verification Evidence：

- 代码是否允许进入 main。
- Capability 是否具备从 Review 进入 Done 的客观执行证据。

CI 不代替 Code Review，不自动修改 Capability Status。

## Flow

```text
Pull Request
  ├─ Backend Verification
  └─ Frontend Verification
          ↓
  Yakable / Quality Gate
          ↓
        Merge
          ↓
 Main Health Verification
```

V1 Trigger：

```text
pull_request → main
push → main
workflow_dispatch
```

## Backend Verification

Runtime：

```text
ubuntu-24.04
Java 21
Docker available
```

执行：

```bash
./mvnw -B -ntp verify
```

保护当前后端真实边界：

```text
Compile
Unit Test
Service Behavior
Controller Contract
Model Plugin Contract
Repository / Mapper
Flyway / Persistence
Integration Test
```

Integration Test 继续使用 Testcontainers + MySQL。

CI 不访问真实 LLM，不依赖生产数据库或生产 Secret。

## Frontend Verification

Runtime：

```text
ubuntu-24.04
Node 22
```

在 `yakable-ui` 执行：

```bash
npm ci
npm run check
npm run build
```

`npm run check` 已包含 typecheck、lint、format:check、Vitest。

`build` 单独保护 production bundle。

## Quality Gate

main Ruleset 只依赖一个稳定 Required Check：

```text
Yakable / Quality Gate
```

成功条件：

```text
Backend Verification = success
AND
Frontend Verification = success
```

### Fail Closed

Quality Gate 即使上游 failed / cancelled / skipped 也必须执行。

实现时使用等价于 `if: always()` 的语义，并显式检查所有 `needs.*.result`。

除全部 success 外，其他状态统一视为 failure。

禁止 Required Quality Gate 因上游失败而自身变成 skipped。

## Concurrency

PR 与 main 使用不同策略。

### Pull Request

同一个 PR 只验证最新 Head。

新 commit 到来时可以取消旧 PR run。

### Main

每一个 main commit 都必须完整执行 Main Health Verification。

后续 main commit 不得取消前一个 main run。

这样每个 main Commit SHA 都保留自己的 Verification Evidence。

## Timeout

V1：

```text
Backend Verification   15 min
Frontend Verification  10 min
Quality Gate            5 min
```

防止 Testcontainers、异步测试或构建异常长期占用 Runner。

## Review → Done

Capability 状态流保持：

```text
Planned → Designing → Implementing → Review → Done
```

进入 Review：

```text
implementation completed
tests added / updated
Capability updated
```

进入 Done：

```text
Review completed
Known Gaps = none
Capability / Code / Tests aligned
Final commit Quality Gate passed
```

### Final Commit Rule

标记 `Status: Done` 的最终 commit 本身必须通过 Quality Gate。

不能拿旧 commit 的 CI 结果证明新的 Done commit。

正确证据链：

```text
Capability: Done
→ Final Commit SHA
→ Tests
→ Quality Gate ✅
→ main
```

因此通常流程是：

```text
implementation + tests
→ Status: Review
→ CI pass
→ Review closed
→ Status: Done
→ final commit
→ CI pass
→ Merge
```

CI 只提供 Evidence，不自动修改 Capability Status。

## Main Protection

main 正常路径：

```text
branch
→ Pull Request
→ Yakable / Quality Gate
→ Merge
```

Ruleset：

```text
Require Pull Request
Require Yakable / Quality Gate
Block merge when Quality Gate fails
```

V1 不要求 Approval 数量。

允许 emergency bypass，但不能作为正常开发方式。

## Main Health Verification

PR Quality Gate 回答：

> 当前 PR 是否允许进入 main？

Main Health Verification 回答：

> 最终 main commit 是否仍然健康？

Main Health 失败时 V1 不自动 rollback，只暴露失败事实。

## Permissions

Verification Workflow 使用最小权限：

```text
permissions:
  contents: read
```

不需要 repository write、PR write、package publish、release 或 push commit 权限。

V1 禁止使用 `pull_request_target`。

## Full Run First

V1 所有 PR 默认完整执行 Backend + Frontend Verification。

暂不做：

```text
changed-files filter
path filter
selective test
module dependency calculation
```

当前测试规模较小，优先保证简单、稳定、可信。

只有 CI 执行时间成为真实问题后，再设计 Incremental CI。

## Explicit Non-Goals

V1 不做：

```text
Coverage Gate
SonarQube
Playwright / Browser E2E
Real LLM Test
Performance Test
Mutation Test
Multi-JDK Matrix
Multi-Node Matrix
AI Review Gate
Automatic Capability Status Update
```

新增 Gate 前必须回答：

> 它解决过什么真实质量问题？

无法回答，不加入。

## Evolution

只有真实问题出现后才升级：

```text
CI P95 持续过长
→ Incremental CI

Vitest 无法证明关键浏览器行为
→ Playwright

数据库兼容问题频繁出现
→ 扩展 Integration Verification

Capability / Test 映射经常失真
→ Capability Verification
```

## Principle

> Harness 定义必须成立的 Contract。

> Tests 把 Contract 变成可执行行为。

> CI 为具体 Commit 提供真实执行证据。

> Done 只能建立在最终 Commit 的 Verification Evidence 上。
