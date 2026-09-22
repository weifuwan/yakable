# Yakable CI Design V1

Status: Designing

## Purpose

Yakable CI 不是为了“项目有 CI”。

CI 的职责只有一个：

> 为代码进入 main，以及 Capability 从 Review 进入 Done，提供可重复、客观、可绑定 Commit SHA 的 Verification Evidence。

CI 不代替 Code Review，不代替 Capability Review，也不自动决定 Capability 是否 Done。

它只回答：

```text
当前代码
+
当前测试
+
当前工程约束
→ 是否仍然成立
```

## Core Contract

正常进入 main 的代码必须经过：

```text
Pull Request
→ Backend Verification
→ Frontend Verification
→ Quality Gate
→ Merge
```

Capability 从：

```text
Status: Review
```

进入：

```text
Status: Done
```

必须同时满足：

```text
Contract aligned
Shared Rules aligned
Scenarios aligned
Tests exist
Review closed
Final commit Quality Gate passed
Known Gaps = none
```

CI 是 Review → Done 的必要条件，但不是唯一条件。

## Trigger

V1 只支持：

```text
pull_request → main
push → main
workflow_dispatch
```

### Pull Request

Pull Request 是主要 Verification 场景。

每次 PR 更新后重新验证当前最新 PR Head。

### Push Main

Merge 后重新验证最终 main commit。

该阶段属于 Main Health Verification，不再决定是否允许 Merge。

### Manual

允许手动执行 CI，用于排查环境问题或重新验证 main。

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

Backend Verification 必须覆盖：

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

遵守：

```text
BACKEND_TEST_README.md
```

测试约定：

```text
maven test
→ 快速 Unit Test

maven verify
→ Unit Test + Integration Test
```

Integration Test 使用现有 Testcontainers + MySQL。

CI 不访问真实 LLM，不依赖生产数据库，不需要生产 Secret。

## Frontend Verification

Runtime：

```text
ubuntu-24.04
Node 22
```

执行：

```bash
npm ci
npm run check
npm run build
```

工作目录：

```text
yakable-ui
```

`npm run check` 当前包含：

```text
TypeScript
Lint
Format Check
Vitest
```

额外执行 `npm run build`，保护 production bundle。

遵守：

```text
yakable-ui/TEST_README.md
```

## Quality Gate

main 的 Required Check 只依赖一个稳定入口：

```text
Yakable / Quality Gate
```

Quality Gate 依赖：

```text
Backend Verification
Frontend Verification
```

成功条件：

```text
Backend Verification = success
AND
Frontend Verification = success
```

其他任何状态都必须使 Quality Gate 失败。

### Fail Closed

Quality Gate 必须始终执行，即使上游 Job failed / cancelled / skipped。

实现时必须使用等价于：

```text
if: always()
```

的语义，再显式判断所有 `needs.*.result`。

禁止因为 Backend / Frontend 失败导致 Required Quality Gate 自己变成 skipped。

最终 Required Check 只有明确的：

```text
success
failure
```

## Concurrency

PR 与 main 使用不同语义。

### Pull Request

同一个 PR 只验证最新提交。

```text
PR commit A
→ CI running

PR commit B
→ cancel A
→ verify B
```

PR 允许：

```text
cancel-in-progress = true
```

### Main

每一个进入 main 的 commit 都必须保留自己的 Verification Evidence。

```text
main commit A
main commit B
main commit C
→ A / B / C 都完整执行
```

main CI 不得因为后续 main commit 到来而取消前一个 main Verification。

## Timeout

所有 Job 必须有明确 timeout。

V1：

```text
Backend Verification   15 min
Frontend Verification  10 min
Quality Gate            5 min
```

用于防止：

```text
Test deadlock
Testcontainers stuck
Async test never completes
Build process hangs
```

## Main Protection

main 的正常开发路径：

```text
branch
→ Pull Request
→ Yakable / Quality Gate
→ Merge
```

main Ruleset 应要求：

```text
Require Pull Request
Require Yakable / Quality Gate
Block merge when Quality Gate fails
```

V1 不要求 Approval 数量。

Yakable 当前是个人开发项目，强制自己 Approve 自己没有额外质量价值。

允许 emergency bypass，但不能作为正常开发方式。

## Review → Done Evidence

Capability 的状态流保持：

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

禁止使用旧 commit 的 CI 结果证明新的 Done commit。

正确流程：

```text
implementation + tests
→ Status: Review
→ CI pass
→ Review closed
→ Status: Done
→ new final commit
→ CI pass again
→ Merge
```

证据必须形成：

```text
Capability: Done
      ↓
Final Commit SHA
      ↓
Tests
      ↓
Quality Gate ✅
      ↓
main
```

CI 不自动修改 Capability Status。

CI 只提供 Verification Evidence。

## Main Health Verification

PR Quality Gate 与 main verification 的语义不同。

### PR Quality Gate

回答：

> 当前 PR 是否允许进入 main？

### Main Health Verification

回答：

> 最终进入 main 的这个 commit 是否仍然健康？

Main Health 失败时，V1 不自动 rollback。

失败表示 main 已经出现需要人工处理的问题。

## CI Permissions

Verification Workflow 默认最小权限：

```text
permissions:
  contents: read
```

CI 不需要：

```text
write repository
write pull request
publish package
create release
push commit
```

V1 禁止使用：

```text
pull_request_target
```

普通 `pull_request` 足以完成 Verification。

## Secrets

CI 不需要：

```text
DEEPSEEK_API_KEY
KIMI_API_KEY
OPENAI_API_KEY
生产数据库账号
生产 Cookie / Token
```

自动化测试禁止访问真实第三方模型服务。

如果一个测试必须依赖生产 Secret 才能通过，它不属于 V1 CI。

## Failure Meaning

CI 中的每一个检查失败都应该能够解释一个明确质量问题。

### Backend Failure

可能表示：

```text
compile regression
business behavior regression
HTTP contract regression
persistence regression
migration regression
model plugin contract regression
```

### Frontend Failure

可能表示：

```text
type regression
lint / format violation
user behavior regression
service protocol regression
production bundle failure
```

禁止增加“失败了但没人知道它保护什么”的 Gate。

## Full Run First

V1 所有 PR 默认完整执行：

```text
Backend Verification
+
Frontend Verification
```

暂不根据 changed files 跳过 Job。

当前测试规模较小，优先保证简单、稳定、可信。

只有 CI 执行时间成为真实问题后，才设计 Incremental CI。

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

## Evolution Rule

只有出现真实需求时才升级 CI。

例如：

```text
CI P95 持续过长
→ 考虑 Incremental CI

关键浏览器行为无法由 Vitest 证明
→ 考虑 Playwright

数据库兼容问题频繁发生
→ 扩展 Integration Verification

Capability / Test 映射经常失真
→ 考虑 Capability Verification
```

不要提前建设未来可能需要的 Gate。

## V1 Workflow

```text
Pull Request
      │
      ├────────────────┐
      ↓                ↓
Backend            Frontend
Verification       Verification
      │                │
      └───────┬────────┘
              ↓
      Yakable / Quality Gate
              ↓
            Merge
              ↓
     Main Health Verification
```

## Principle

> Harness 定义什么必须成立。

> Tests 把稳定 Contract 变成可执行行为。

> CI 为具体 Commit 提供真实执行证据。

> Done 只能建立在最终 Commit 的 Verification Evidence 上。
