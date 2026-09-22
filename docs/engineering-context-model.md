# Yakable Engineering Context Model

Status: Active

Scope:
- Product development
- Code changes
- Testing
- Verification
- AI context loading

Owns:
- Engineering document roles
- Context loading order
- Evidence chain from requirement to verified commit

## Core Model

```text
What to build
→ Capability Contract

How to code
→ *_RULES.md

Where things belong
→ ARCHITECTURE.md

How to test
→ *_TEST_RULES.md

How to prove
→ CI Verification
```

这五类文档分别回答五个不同问题，不互相替代。

## What to build → Capability Contract

Capability Contract 定义稳定产品行为。

它回答：

```text
这个能力是什么？
必须满足什么 Contract？
受哪些 Shared Rules 约束？
涉及哪些跨能力 Scenario？
当前状态是什么？
```

产品行为变化先定位 Capability，不从代码结构反推产品需求。

## How to code → *_RULES.md

RULES 定义写代码时必须遵守的稳定约束。

它回答：

```text
这一层允许怎么写？
禁止怎么写？
依赖边界是什么？
需要加载哪些更具体的规则？
```

规则放在离代码最近的位置。

README 不承担代码约束。

## Where things belong → ARCHITECTURE.md

ARCHITECTURE 定义当前结构事实和 ownership。

它回答：

```text
代码应该放在哪？
模块之间怎么依赖？
谁拥有这类能力？
什么不属于这里？
```

Architecture 描述当前真实结构，不提前设计未来层级。

## How to test → *_TEST_RULES.md

Test Rules 定义什么行为需要证据，以及最小测试边界。

它回答：

```text
什么必须测试？
在哪一层测试？
Mock 什么？
什么时候需要 Integration Test？
什么不值得测试？
```

测试保护稳定行为，不保护实现细节和覆盖率数字。

## How to prove → CI Verification

CI Verification 为具体 Commit 提供客观执行证据。

它回答：

```text
当前代码和测试是否真实执行过？
Backend / Frontend Verification 是否通过？
最终 Commit 是否具备进入 main / Done 的证据？
```

CI 不定义产品行为，也不自动决定 Capability Status。

## Context Loading

收到开发任务后，默认按以下顺序收敛 Context：

```text
Task
→ Capability Contract
→ ARCHITECTURE.md
→ Nearest *_RULES.md
→ Relevant *_TEST_RULES.md
→ Target Code / Tests
→ CI Verification
```

只加载当前任务实际涉及的规则和代码，不默认扫描整个仓库。

## Evidence Chain

一个完整变更应该能够形成：

```text
Capability Contract
→ Architecture ownership
→ Code Rules
→ Test Rules
→ Implementation + Tests
→ CI Verification
→ Verified Commit
```

如果链条中某一层缺失，先判断它是否真的需要补，而不是机械创建文档。

## Document Creation Rule

新增工程文档前必须先问：

> 它属于这五类中的哪一类？

```text
Capability Contract
Code Rules
Architecture
Test Rules
CI Verification
```

如果无法归类，优先检查：

- 信息是否应该合并到现有文档。
- 是否只是一次性实现过程。
- 是否已经能从代码、测试或 Git History 得到。
- 是否真的值得成为长期 Context。

不要为了“流程完整”增加新的文档类型。

## Boundary

This model does not own:
- Product details
- Module-specific coding rules
- Concrete architecture contents
- Individual test cases
- CI implementation details

它只定义这些 Context 如何分工、如何被加载、如何组成一条可验证的工程链路。

## Principle

> **What to build → Capability Contract.**

> **How to code → *_RULES.md.**

> **Where things belong → ARCHITECTURE.md.**

> **How to test → *_TEST_RULES.md.**

> **How to prove → CI Verification.**
