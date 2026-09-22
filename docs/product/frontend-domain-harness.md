# Frontend Domain Harness Philosophy

> **Put certainty in the Harness. Put uncertainty in the Agent.**

This document defines the architectural boundary between the Yakable Agent and the Frontend Domain Harness.

It is not a description of one implementation. It is a product and engineering principle for how Yakable should evolve.

---

## 1. What Yakable is building

Yakable is **not** trying to become a general-purpose coding agent.

A general-purpose agent maximizes freedom: it can choose the stack, project structure, dependencies, implementation style, UI patterns, tools, and execution strategy.

Yakable should do the opposite wherever the domain already gives us a better answer.

Yakable is a **frontend-domain system**:

```text
Frontend Domain Harness
        │
        ├── rules
        ├── patterns
        ├── components
        ├── templates
        ├── context policy
        ├── tools and permissions
        ├── execution environment
        └── evaluation criteria
        │
        ▼
      Agent
        │
        ├── understand
        ├── choose
        ├── plan
        ├── adapt
        └── repair
        │
        ▼
      Result
        │
        ▼
       Eval
        │
        └── feedback / repair
```

The Agent supplies intelligence.

The Harness supplies determinism, domain knowledge, constraints, reusable building blocks, and quality standards.

The goal is not to make the Agent more free. The goal is to make the Agent free **only where intelligence is actually required**.

---

## 2. The core rule

Whenever we design a Yakable capability, ask:

> **Does this require intelligent judgment, or stable execution?**

If the answer is stable execution, it belongs in the Harness.

If the answer requires understanding ambiguity, weighing trade-offs, adapting to unknown project state, or recovering from unexpected results, it belongs in the Agent.

A stronger version of the rule is:

- If it can be decided in advance, do not ask the model to decide it.
- If it can be calculated by code, do not ask the model to guess it.
- If it can be reused as a template or component, do not ask the model to regenerate it.
- If it can be verified by a deterministic check, do not ask the model whether it is correct.
- If the same decision keeps appearing in prompts, consider moving that decision into the Harness.

The model should spend its intelligence budget on the uncertain remainder.

---

## 3. Agent responsibility: the verbs

A useful mental model is:

> **The Agent owns verbs.**

The Agent should primarily own actions that require interpretation or adaptation:

- understand user intent;
- resolve ambiguity;
- classify the task;
- decide what information is needed next;
- choose among approved patterns and components;
- decide which project files are relevant;
- choose an allowed tool;
- plan work when the path is not fully known;
- adapt a known pattern to business requirements;
- interpret runtime or visual evidence;
- recover from unexpected failures;
- decide how to repair a result within Harness constraints.

Examples:

```text
"Make this page less crowded."
```

The Agent may need to determine whether the problem is spacing, information density, typography, layout, or component composition.

```text
"Build a CRM dashboard and make today's follow-ups the focus."
```

The Agent may decide that today's follow-ups should be primary information, revenue should be secondary, and a task-oriented dashboard pattern is more appropriate than an analytics-heavy pattern.

Those are semantic decisions. They should remain intelligent.

---

## 4. Harness responsibility: the nouns and rules

A second useful mental model is:

> **The Harness owns nouns, rules, boundaries, and defaults.**

The Harness should own decisions that Yakable can make once and reuse consistently.

### Technical environment

The Agent should not freely choose:

- React version;
- TypeScript version;
- Tailwind version;
- router choice;
- package manager;
- supported dependency set;
- build commands;
- lint/typecheck commands;
- project folder conventions;
- naming conventions.

These belong to the Harness.

### Design system

The Agent should not reinvent:

- typography scales;
- spacing scales;
- radius scales;
- color tokens;
- shadows;
- layout containers;
- breakpoints;
- motion defaults;
- accessibility defaults.

These belong to the Harness.

### Components

If Yakable already knows how a good primitive should work, the Agent should select it rather than regenerate it.

Examples:

```text
Button
Input
Select
Dialog
Table
Card
Tabs
Navigation
EmptyState
```

The Agent can decide **which** component is appropriate.

The Harness defines **what that component is** and what variants are allowed.

### UI patterns

The same principle applies at a larger scale.

Yakable should accumulate reusable frontend patterns such as:

```text
Dashboard
Data Table
Settings
Form
Detail Page
Authentication
Landing Page
Empty State
Command / Search
Master-Detail
```

The Agent should increasingly perform:

```text
select + compose + adapt
```

instead of:

```text
generate everything from scratch
```

Selection is more stable than unconstrained generation.

---

## 5. The responsibility matrix

| Capability | Agent | Frontend Domain Harness |
| --- | --- | --- |
| Understand natural-language intent | Owns | Provides domain vocabulary/examples |
| Resolve ambiguity | Owns | Provides allowed boundaries/defaults |
| Classify task | Owns | Defines supported task classes |
| Select page pattern | Chooses | Defines patterns |
| Select component | Chooses | Defines component registry |
| Decide information priority | Owns | Provides hierarchy rules/examples |
| React / TS / Tailwind versions | No | Owns |
| Dependency policy | No | Owns |
| Project structure | No | Owns |
| Design tokens | No | Owns |
| Typography / spacing / radius | No | Owns |
| Base component implementation | No | Owns |
| Context need | Decides what it needs | Controls retrieval, limits, ordering, compaction |
| Tool selection | Chooses from allowed tools | Defines tools, permissions, contracts |
| File selection | Chooses relevant files | Enforces project/context boundaries |
| Implementation adaptation | Owns | Provides coding rules/patterns |
| Build / lint / typecheck | No judgment required | Owns deterministic execution |
| Visual quality criteria | Interprets findings when needed | Owns rubric, thresholds, rules |
| Repair strategy | Owns within constraints | Provides repair rules and safe execution |

---

## 6. Context boundary

Context is one of the clearest Agent/Harness boundaries.

The Agent may decide:

> "I need the current page, the table implementation, and the layout rules."

The Agent should **not** own the mechanics of dumping arbitrary repository history into the model window.

The Harness owns how context is safely and consistently supplied:

```text
Current task
+
Relevant project files
+
Relevant UI pattern
+
Design tokens
+
Project rules
+
Recent decisions / continuity
+
Runtime evidence when needed
```

The division is:

> **Agent decides what information is useful. Harness decides how that information is selected, bounded, ordered, compacted, and delivered.**

This implies that token budgets, conversation compaction, retrieval policy, source limits, and context priority are Harness infrastructure rather than prompt-local behavior.

---

## 7. Tool boundary

The Agent may decide:

> "I need to read this file."

or:

> "I need to run a project check."

The Harness defines the tool contract:

- which tools exist;
- which modes may use them;
- which directories may be read or written;
- how much content can be returned;
- which commands are allowed;
- how writes are applied safely;
- when rollback is required;
- which checks must run after mutation;
- what tool output is considered valid.

The division is:

> **Agent chooses a tool. Harness defines the tool and its boundaries.**

The existence of model-driven tool selection must not turn into unrestricted execution.

---

## 8. Planning boundary

Yakable should not confuse planning with freedom.

The Agent may plan **inside a domain workflow**, but known workflow invariants should remain deterministic.

For example, these are good Harness-level invariants:

```text
source mutation
→ project health check
→ preview observation
→ visual evaluation
→ bounded repair when justified
```

The Agent may make intelligent decisions inside that lifecycle:

- what to edit;
- what context to request;
- which approved pattern to use;
- whether an observed mismatch is relevant to the user's intent;
- how to repair the mismatch.

We should not replace stable product behavior with an unconstrained "figure out what to do next" loop merely to make the system look more agentic.

---

## 9. Evaluation is the quality arm of the Harness

Yakable should not rely on the model saying:

> "Done."

Correctness and quality should be grounded in evidence.

Deterministic checks belong to the Harness:

```text
build
lint
typecheck
runtime health
allowed dependency checks
project structure checks
```

Frontend quality criteria should also progressively move from vague model taste into explicit Harness knowledge:

```text
spacing rules
visual hierarchy
component consistency
responsive behavior
interaction states
accessibility
forbidden patterns
preferred patterns
```

A Design Critic may use model intelligence to interpret a page, but the definition of "good" should increasingly come from the Harness.

The desired loop is:

```text
Agent
  ↓
Result
  ↓
Harness Eval
  ↓
PASS ───────────────→ Done
  │
  └── concrete finding
          ↓
       Agent repair
          ↓
       evaluate again
```

The long-term advantage is not merely that Yakable can generate frontend code.

It is that Yakable increasingly knows **what a good frontend result means**.

---

## 10. A concrete example

User request:

```text
Build a SaaS admin app for managing customers.
```

A general-purpose Agent may need to decide all of the following at runtime:

```text
framework
versions
dependencies
folder structure
font
colors
spacing
sidebar implementation
table implementation
form implementation
modal implementation
responsive behavior
page hierarchy
business-specific behavior
```

That is too much model-controlled surface area.

A mature Yakable Harness should already provide:

```text
framework                  fixed
versions                   fixed
dependency policy          fixed
project structure          fixed
design tokens              fixed
component primitives       fixed
sidebar pattern            available
table pattern              available
form pattern               available
modal pattern              available
responsive rules           fixed
accessibility rules        fixed
build/check pipeline        fixed
```

The Agent is left with the decisions that actually benefit from intelligence:

```text
What is the user's business intent?
Which pages are needed?
What information is primary?
Which approved patterns fit this product?
How should those patterns be composed?
Where is domain-specific customization required?
```

Reducing freedom here does not reduce product intelligence.

It concentrates intelligence where it matters.

---

## 11. How to classify current Yakable modules

Some existing Yakable modules already contain the beginnings of this architecture.

### Primarily Agent

These capabilities are intelligence-oriented and should continue to evolve as Agent behavior:

- intent understanding;
- UI planning;
- task-specific context need;
- choosing relevant files;
- choosing among allowed tools/patterns;
- interpreting runtime/visual evidence;
- selecting a repair strategy.

### Primarily Harness

These capabilities should increasingly become explicit domain infrastructure:

- Context policies and budgets;
- Capability and permission boundaries;
- Tool contracts and permissions;
- project templates;
- stack/dependency policy;
- component registry;
- page/layout pattern registry;
- design tokens;
- frontend coding rules;
- deterministic project checks;
- design evaluation rubric;
- examples of accepted and rejected results.

### Hybrid capabilities

Some systems intentionally sit on the boundary.

#### Design Critic

Agent-like part:

- interpret rendered evidence;
- relate a visual problem to user intent.

Harness part:

- define the rubric;
- define forbidden/preferred patterns;
- define measurable design constraints;
- define what evidence is required before reporting a finding.

#### Visual Repair

Agent-like part:

- decide the smallest appropriate repair.

Harness part:

- constrain repair scope;
- validate the result;
- rollback unsafe changes;
- limit iterations.

---

## 12. The migration rule

A capability does not have to start in the Harness.

Early in development, the fastest way to discover a useful rule may be to let the Agent handle it.

But repeated model decisions should be treated as candidates for extraction.

Use this lifecycle:

```text
unknown problem
    ↓
Agent handles it
    ↓
we observe repeated decisions
    ↓
we learn the stable rule/pattern
    ↓
move the stable part into the Harness
    ↓
Agent keeps only the remaining uncertainty
```

This is how Yakable should accumulate domain advantage over time.

The Harness is therefore not a static prompt collection.

It is **distilled frontend expertise turned into executable product infrastructure**.

---

## 13. Maturity metric: model decision surface

A useful way to evaluate Harness maturity is to measure how many product decisions still have to be invented by the model at runtime.

Early system:

```text
100 decisions
90 guessed by the model
10 controlled by the Harness
```

More mature system:

```text
100 decisions
30 require Agent judgment
70 are controlled by the Harness
```

Highly mature domain system:

```text
100 decisions
15 require Agent judgment
85 are controlled by the Harness
```

The exact numbers are not important.

The direction is.

> **As the Harness matures, the model decision surface should shrink.**

This does not mean removing intelligence. It means removing unnecessary uncertainty.

---

## 14. Anti-goals

Yakable should avoid the following architectural traps:

### Do not optimize for "more agentic" as a goal by itself

A dynamic Agent loop is useful when the task genuinely requires dynamic decisions. It is not automatically better than a deterministic domain workflow.

### Do not let the model choose stable infrastructure repeatedly

Stack versions, project conventions, primitive components, and standard checks should not vary from one generation to the next without an explicit product reason.

### Do not regenerate knowledge that can be encoded

If a good table, form, dashboard, or empty-state pattern has already been learned, turn it into reusable Harness knowledge.

### Do not hide product rules inside giant prompts

A rule that matters to product quality should become an explicit contract, pattern, registry, policy, validator, or evaluator whenever possible.

### Do not build a general coding agent by accident

Yakable's advantage comes from being opinionated about frontend quality, not from maximizing the number of arbitrary tasks the runtime can perform.

---

## 15. Architectural north star

The long-term architecture should feel like this:

```text
                    User Intent
                        │
                        ▼
        ┌──────────────────────────────┐
        │   Frontend Domain Harness    │
        │                              │
        │  Context / Rules / Patterns  │
        │  Components / Skills / Tools │
        │  Environment / Constraints   │
        │  Evaluation / Guardrails     │
        │              │               │
        │              ▼               │
        │            Agent             │
        │     Understand / Decide      │
        │       Select / Adapt         │
        │              │               │
        │              ▼               │
        │            Result            │
        │              │               │
        │              ▼               │
        │             Eval             │
        │              │               │
        │         repair if needed     │
        └──────────────┼───────────────┘
                       ▼
                      Done
```

The Agent is important, but it is not the product boundary.

The Harness is what turns a capable model into a consistent Yakable frontend engineer.

---

## 16. Decision checklist

Before adding a new model decision, ask:

1. Can this decision be made deterministically?
2. Is there already a Yakable default that should apply?
3. Can this become a component, pattern, token, template, rule, or validator?
4. Will users benefit from this varying from run to run?
5. Does the model have information that code cannot reliably derive?
6. Does this decision genuinely require semantic judgment?
7. Can the output be verified without another subjective model call?

If the first three answers are mostly yes, move the capability toward the Harness.

If the decision depends on ambiguous human intent or unexpected environment state, keep the intelligent part in the Agent.

---

## 17. One sentence to keep

> **Yakable is not trying to make AI more free. Yakable is trying to make AI free only where intelligence is necessary.**

And the engineering version:

> **Put certainty in the Harness. Put uncertainty in the Agent.**
