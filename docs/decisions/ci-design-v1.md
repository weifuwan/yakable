# Yakable CI Verification V1

Status: Review

Scope:
- Repository Verification
- Pull Request Gate
- Main Health
- Capability Review → Done

Protects:
- Backend Contract
- Frontend Contract
- Final Commit Evidence
- main

Backend:
- Runtime: ubuntu-24.04 / Java 21 / Docker
- Command: `./mvnw -B -ntp verify`

Frontend:
- Runtime: ubuntu-24.04 / Node 22
- Working Directory: `yakable-ui`
- Commands:
  - `npm ci`
  - `npm run check`
  - `npm run build`

Workflow:
- `.github/workflows/ci.yml`

Required Check:
- `Yakable / Quality Gate`

Triggers:
- `pull_request → main`
- `push → main`
- `workflow_dispatch`

Main Rules:
- Require Pull Request
- Require `Yakable / Quality Gate`
- No required approval count
- Emergency bypass only

Shared Rules:
- CI-001
- CI-002
- CI-003
- CI-004
- CI-005
- CI-006

## Contract

### CI-001 — Verification Evidence

CI 为具体 Commit SHA 提供 Verification Evidence。

CI 不自动修改 Capability Status。

### CI-002 — Quality Gate

Quality Gate 成功条件：

```text
Backend Verification = success
AND
Frontend Verification = success
```

除此之外全部失败。

Quality Gate 必须 fail closed。

即使上游 Job failed / cancelled / skipped，Quality Gate 仍必须执行并产生明确结果。

实现时使用等价于 `if: always()` 的语义，并显式检查所有 `needs.*.result`。

### CI-003 — Pull Request Verification

同一个 PR 只验证最新 Head。

```text
new PR commit
→ cancel previous PR run
→ verify latest Head
```

PR 可以使用 `cancel-in-progress`。

### CI-004 — Main Verification

每一个进入 main 的 Commit 都必须完整执行 Main Health Verification。

```text
main A
main B
main C
→ A / B / C 都保留独立 Verification Evidence
```

后续 main commit 不得取消前一个 main run。

### CI-005 — Review → Done

Capability 进入 Done 必须满足：

```text
Review completed
Known Gaps = none
Capability / Code / Tests aligned
Final Commit Quality Gate passed
```

标记 `Status: Done` 的最终 Commit 本身必须通过 CI。

禁止使用旧 Commit 的 CI 结果证明新的 Done Commit。

CI 只提供 Evidence，不自动决定 Done。

### CI-006 — Minimum Permission

Verification Workflow 默认权限：

```text
permissions:
  contents: read
```

禁止使用 `pull_request_target`。

CI 不需要生产 Secret、真实 LLM Key 或生产数据库凭证。

## Flow

```text
Implement
→ Tests
→ Status: Review
→ Pull Request
→ Backend Verification
→ Frontend Verification
→ Quality Gate
→ Review Closed
→ Status: Done
→ Final Commit
→ Quality Gate
→ Merge
→ Main Health Verification
```

## Backend Verification

执行：

```bash
./mvnw -B -ntp verify
```

验证：

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

Integration Test 使用 Testcontainers + MySQL。

不访问真实 LLM。

## Frontend Verification

执行：

```bash
cd yakable-ui
npm ci
npm run check
npm run build
```

`npm run check` 当前负责：

```text
TypeScript
Lint
Format Check
Vitest
```

`npm run build` 负责 production bundle。

## Timeout

```text
Backend Verification   15 min
Frontend Verification  10 min
Quality Gate            5 min
```

## Non-Goals

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
Changed-file Test Selection
Path Filter
Automatic Capability Status Update
```

新增 Gate 前必须回答：

> 它解决什么已经存在的质量问题？

没有真实问题，不加入。

## Evolution

```text
CI P95 持续过长
→ Incremental CI

Vitest 无法证明关键浏览器行为
→ Playwright

数据库兼容问题频繁出现
→ Integration Verification

Capability / Test 映射经常失真
→ Capability Verification
```

## Boundary

Owns:
- Verification execution
- Commit evidence
- Pull Request quality gate
- Main health verification

Does Not Own:
- Capability design
- Code Review
- Product acceptance
- Automatic Status changes
- Deployment
- Release

## Principle

> Harness 定义必须成立的 Contract。

> Tests 把 Contract 变成可执行行为。

> CI 为具体 Commit 提供真实执行证据。

> Done 只能建立在最终 Commit 的 Verification Evidence 上。
