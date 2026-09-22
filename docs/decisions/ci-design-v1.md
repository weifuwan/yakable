# Yakable CI Design V1

Status: Designing

## Purpose

Yakable CI 只解决一个问题：

> 为代码进入 main，以及 Capability 从 Review 进入 Done，提供可重复、可绑定 Commit SHA 的 Verification Evidence。

CI 不代替 Code Review，不自动决定 Capability 是否 Done。

## Verification Flow

```text
Pull Request
      │
      ├───────────────┐
      ↓               ↓
Backend           Frontend
Verification      Verification
      │               │
      └───────┬───────┘
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

必须覆盖：

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

工作目录：

```text
yakable-ui
```

执行：

```bash
npm ci
npm run check
npm run build
```

`npm run check` 当前包含：

```text
typecheck
lint
format:check
vitest
```

额外执行 `build`，保护 production bundle。

## Quality Gate

main 的 Required Check 只依赖：

```text
Yakable / Quality Gate
```

成功条件：

```text
Backend Verification = success
AND
Frontend Verification = success
```

其他任何状态都必须失败。

### Fail Closed

Quality Gate 必须始终执行，即使上游 failed / cancelled / skipped。

实现时使用等价于：

```text
if: always()
```

的语义，并显式检查 `needs.*.result`。

禁止 Backend / Frontend 失败时让 Required Quality Gate 自己变成 skipped。

## Concurrency

PR 与 main 使用不同策略。

### Pull Request

同一个 PR 只验证最新提交：

```text
new PR commit
→ cancel previous PR CI
→ verify latest
```

允许 `cancel-in-progress: true`。

### Main

每一个进入 main 的 commit 都必须保留完整 Verification Evidence。

```text
main A
main B
main C
→ A / B / C 都完整执行
```

main CI 不得因为后续 commit 到来而取消前一个 run。

## Timeout

V1：

```text
Backend Verification   15 min
Frontend Verification  10 min
Quality Gate            5 min
```

防止 Testcontainers、异步测试或构建异常长期占用 Runner。

## Review → Done

状态流：

```text
Planned
→ Designing
→ Implementing
→ Review
→ Done
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

不能使用旧 commit 的 CI 结果证明新的 Done commit。

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

证据链必须是：

```text
Capability: Done
→ Final Commit SHA
→ Tests
→ Quality Gate ✅
→ main
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

main verification 回答：

> 最终 main commit 是否仍然健康？

Main Health 失败时 V1 不自动 rollback，只暴露失败事实。

## Permissions

Verification Workflow 使用最小权限：

```text
permissions:
  contents: read
```

不需要：

```text
repository write
PR write
package publish
release
push commit
```

V1 禁止使用 `pull_request_target`。

## Full Run First

V1 所有 PR 默认完整执行：

```text
Backend Verification
+
Frontend Verification
```

暂不做 changed-files / path filter / selective test。

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
Complex Path Filter
Changed-file Test Selection
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
