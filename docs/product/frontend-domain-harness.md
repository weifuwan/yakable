# Frontend Domain Harness

Status: Direction

> **Put certainty in the Harness. Put uncertainty in the Agent.**

## Product Direction

Yakable 不是通用 Coding Agent。

Yakable 是 Frontend Domain System：

```text
Frontend Domain Harness
├── rules
├── patterns
├── components
├── templates
├── context policy
├── tools / permissions
├── execution environment
└── evaluation criteria
        ↓
      Agent
        ↓
      Result
        ↓
       Eval
```

Agent 提供需要语义判断的智能。

Harness 提供可以提前确定的规则、默认值、边界、可复用资产和验证能力。

## Core Rule

每次设计能力时问：

> **这件事需要智能判断，还是稳定执行？**

如果可以提前决定、由代码计算、模板复用或确定性验证，就优先进入 Harness。

如果依赖模糊的人类意图、未知项目状态、权衡或异常修复，再交给 Agent。

## Agent Owns

Agent 主要负责“动词”：

- understand intent。
- resolve ambiguity。
- classify task。
- choose relevant context。
- choose approved pattern / component / tool。
- adapt to business requirements。
- interpret runtime / visual evidence。
- choose repair strategy。

## Harness Owns

Harness 主要负责“名词、规则、边界和默认值”：

- stack / dependency policy。
- project structure。
- design tokens。
- component registry。
- page / layout patterns。
- context budgets / ordering / compaction。
- tool contracts / permissions。
- build / lint / typecheck。
- deterministic checks。
- evaluation rubric。
- safe mutation / rollback rules。

## Context Boundary

```text
Agent
→ decides what information is useful

Harness
→ selects
→ bounds
→ orders
→ compacts
→ delivers
```

不要让模型通过巨型 Prompt 隐式拥有 Context Policy。

## Tool Boundary

```text
Agent chooses an allowed tool.
Harness defines the tool and its boundaries.
```

工具必须明确：

- read / write scope。
- output limit。
- allowed commands。
- permissions。
- post-write checks。
- rollback requirements。

## Evaluation

Yakable 不以模型说“Done”为完成标准。

确定性检查属于 Harness：

- build。
- lint。
- typecheck。
- runtime health。
- dependency policy。
- project structure。

视觉质量中的稳定知识也应逐渐转成明确 rubric / rule / pattern。

## Migration Rule

一个规则可以先由 Agent 探索。

当同一种决定不断重复出现时：

```text
Agent handles uncertainty
→ repeated decision appears
→ stable rule is learned
→ stable part moves into Harness
→ Agent keeps only remaining uncertainty
```

## Maturity Direction

> **As the Harness matures, the model decision surface should shrink.**

不是减少智能，而是减少不必要的不确定性。

工程版：

> **能确定的，不让 AI 猜。**
