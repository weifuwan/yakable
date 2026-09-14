# Yakable Direction

> Build a specialized frontend harness that can understand product intent, plan an interface, execute changes, observe the rendered result, critique it, and improve it through bounded iteration.

## North Star

Yakable is not trying to become a general-purpose coding agent.

Yakable is a **Frontend Harness**: a system specialized in turning product intent into high-quality frontend experiences through planning, building, observation, evaluation, and controlled repair.

The long-term question is not:

> How do we make the model more autonomous?

It is:

> How do we make frontend decisions more explicit, execution more reliable, visual quality more observable, and iteration more grounded?

Yakable should become increasingly strong at:

- understanding what the user is trying to build or change
- translating vague frontend language into usable design intent
- planning page structure and hierarchy before implementation
- selecting only the context needed for the current task
- implementing frontend changes inside explicit boundaries
- rendering and observing the real result
- evaluating the result against intent and evidence
- applying limited repair when the result is materially wrong
- preserving user decisions instead of silently redefining them during execution

## Product Model

Yakable should expose two first-class working modes.

### Plan Mode

Plan Mode is for **understanding, exploring, deciding, and reviewing**.

It may:

- understand product and edit intent
- read and search project context
- inspect the current Preview and observations
- reason about layout, hierarchy, interaction, responsive behavior, and frontend architecture
- use frontend taste knowledge and design-system context
- create and revise a structured plan
- ask focused questions when an important decision cannot be inferred safely

It must not:

- mutate project source
- install dependencies
- perform Visual Repair
- silently execute the plan

The primary output of Plan Mode is an explicit, reviewable **Plan Artifact**.

### Build Mode

Build Mode is for **executing an approved intent or plan**.

It may:

- select focused context
- read and search source
- edit project files inside bounded scope
- run deterministic project checks
- render the project
- observe the Preview
- critique the rendered result
- perform bounded repair

Build Mode should not silently redefine an approved plan. When execution discovers that the plan is no longer valid, Yakable should stop or return to planning instead of hiding a new plan inside implementation.

## Core Architecture

```text
                    User Request
                         │
                         ▼
                   Intent Layer
          ┌──────────────┴──────────────┐
          │                             │
      Product Intent               Edit Intent
          │                             │
          └──────────────┬──────────────┘
                         ▼
                     PLAN MODE
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Design Intent           Code Context
              │                     │
              ▼                     ▼
          UI Planner             Explore
              │                     │
              └──────────┬──────────┘
                         ▼
                    Plan Artifact
                         │
                    Review / Approve
                         │
                         ▼
                    BUILD MODE
                         │
                         ▼
                  Frontend Agent
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
      Read             Search             Edit
                         │
                         ▼
                       Check
                         │
                         ▼
                      Render
                         │
                         ▼
                   Observation
                         │
                         ▼
                  Design Critic
                         │
                  ┌──────┴──────┐
                  ▼             ▼
                PASS           FAIL
                  │             │
                  │             ▼
                  │           Repair
                  │             │
                  └──────┬──────┘
                         ▼
                        Done
```

The architecture should remain understandable as the product grows. New capabilities should have an obvious place in this model instead of becoming another disconnected prompt or agent.

## Frontend Intelligence

Plan Mode and Build Mode should share one frontend-specific intelligence layer.

```text
Frontend Intelligence
├── Prompt Intent
├── Semantic Expansion
├── Taste Translation
├── Design Intent
├── UI Planning
├── Taste Library & Retrieval
├── Component / Pattern Knowledge
├── Design-System Context
├── Page Observation
├── Design Critic
└── Visual Repair
```

This layer is where Yakable should differentiate itself from general coding agents.

Frontend quality is not only color, radius, shadow, or animation. It also includes:

- information hierarchy
- section composition
- density
- emphasis
- interaction placement
- responsive behavior
- component choice
- what should not be added
- what should remain unchanged

Taste should gradually become a reusable system capability rather than a collection of prompt adjectives.

## Plan Artifact

Planning should produce structured data internally, not only free-form Markdown.

A future Plan Artifact should be able to represent concepts such as:

```ts
interface YakablePlan {
  version: 1;
  goal: string;

  context: {
    projectType: string;
    relevantFiles: string[];
    currentBehavior?: string;
  };

  decisions: Array<{
    decision: string;
    reason: string;
  }>;

  ui?: UIPlan;

  implementation: Array<{
    id: string;
    title: string;
    purpose: string;
    files?: string[];
  }>;

  validation: string[];
  constraints: string[];
  openQuestions: string[];
}
```

The exact schema should stay small and evolve from real needs. Yakable should avoid inventing a broad layout DSL before it is necessary.

The same Plan Artifact should be renderable as human-readable Markdown for review while remaining machine-readable for Build Mode.

## UI Planner

UI Planner is a capability inside Plan Mode, not a replacement for Plan Mode.

Its responsibility is to translate product and design intent into an explicit frontend page blueprint before code generation.

UI Planner should answer questions such as:

- what kind of page or product surface is this?
- what shell or navigation structure fits?
- which sections belong on the page?
- what is primary vs secondary?
- which UI pattern best expresses each section?
- what responsive behavior matters?
- what should be intentionally omitted?

UI Planner v0 should stay small. It does not need a visual AST, constraint solver, or universal layout language.

## Execution Model

Yakable prefers **bounded deterministic execution** over unrestricted autonomy.

Current execution philosophy:

- models reason inside explicit capability boundaries
- tools have explicit contracts
- project context is selected before it is read
- edits are bounded to focused source context
- health checks are deterministic
- rendered output is observed instead of assumed
- critique must be grounded in available evidence
- unsupported visual certainty is reported as unverified
- repair attempts are limited
- loops always have explicit stopping conditions
- progress events describe execution state, not hidden chain-of-thought

Frontend Agent should remain an execution state machine unless real usage proves that broader model-selected tool orchestration is necessary.

## Mode Permissions

Plan and Build enforce different capability policies, not merely different prompts.

| Capability | Plan | Build |
| --- | --- | --- |
| Understand intent | Yes | Yes |
| Read project | Yes | Yes |
| Search project | Yes | Yes |
| Inspect Preview | Yes | Yes |
| Page Observation | Yes | Yes |
| Design Critic | Yes | Yes |
| Create / revise Plan Artifact | Next | Read / execute later |
| Generate source | No | Yes |
| Edit source | No | Yes |
| Visual Repair | No | Yes |
| Add files | No | Bounded |
| Change dependencies | No | Bounded |
| External write tools | No | Explicitly gated |

The v0 contract is represented as a versioned `PLAN | BUILD` mode policy with explicit capabilities. Plan exposes only `read-project`, `search-project`, `observe-preview`, and `critique-design`; Build additionally exposes `generate-source`, `edit-source`, and `repair-source`. Existing product flows remain Build by default until the Plan Artifact and Plan UI exist.

This separation is the foundation for future Plan orchestration, MCP, and external-tool permission policies.

## Current Foundation

Yakable already has working foundations for:

- Build Intent routing
- Prompt Intelligence
- Semantic Expansion
- Taste Translation
- Design Intent
- Base Template and Capability Packs
- persistent project and conversation context
- Visual-to-Source selection
- bounded Context Selection and Search
- safe project reads
- focused Project Editing
- deterministic project checks
- one-shot build repair
- controlled Runtime and Preview
- source-mapped Page Observation
- Edit Intent Delta
- evidence-grounded Design Critic
- bounded Visual Repair with rollback
- explicit Frontend Agent execution states and live progress
- Plan / Build mode capability policy with a read-only Plan mutation boundary

These capabilities are foundations, not the roadmap itself.

## Current Stage

```text
Stage A — Understand          ✅
Stage B — Build               ✅
Stage C — Observe             ✅
Stage D — Evaluate & Repair   ✅
Stage E — Plan                ← CURRENT
Stage F — Taste Intelligence
Stage G — Extensible Tools
Stage H — Production
```

## Current Focus — Stage E: Plan

Goal: **separate decision-making from source mutation and make frontend decisions reviewable before execution.**

Near-term work should focus on the following outcomes, without locking them to permanent PR numbers:

1. **Plan / Build Mode Contract** ✅
   - make the two modes first-class concepts
   - enforce a capability policy instead of relying on prompt instructions
   - keep Plan read-only with respect to project source
   - preserve Build as the compatibility default until Plan has a real product surface

2. **Plan Artifact + Review** ← NEXT
   - create a small versioned structured Plan Artifact
   - render it in a human-readable form
   - allow revise / approve / reject before Build

3. **UI Planner v0**
   - compile Design Intent into a small page / section / hierarchy / responsive blueprint
   - support both CREATE planning and focused EDIT planning

4. **Build From Approved Plan**
   - pass the approved Plan Artifact into generation or Frontend Agent execution
   - preserve approved decisions during Build
   - surface deviations instead of silently replanning

5. **Re-plan / Plan Diff**
   - allow a changed user request or new evidence to revise the plan explicitly
   - make plan changes visible before execution

## Next Stages

### Stage F — Taste Intelligence

Goal: make frontend taste reusable, retrievable, and testable.

Potential areas:

- Taste Library and retrieval
- design-direction suggestions
- component and pattern knowledge
- design-system-aware planning
- richer visual evidence when technically justified
- better critic dimensions and calibration

### Stage G — Extensible Tools

Goal: extend the harness without losing capability boundaries.

Potential areas:

- MCP adapter over the internal Tool contract
- browser and external research tools
- Figma / design-system integrations
- provider-independent prompt compilation
- explicit permission policies for external actions

### Stage H — Production

Goal: make Yakable reliable for sustained real-world use.

Potential areas:

- versioning and rollback
- long-running context robustness
- deployment
- GitHub sync
- collaboration
- model routing
- full-stack capabilities when product demand requires them

## Design Principles

### Complex systems, simple user experience

Complexity should live inside Yakable's contracts and orchestration, not in forms the user has to understand.

### Plan before mutation when the decision matters

When a request contains meaningful product, architecture, or visual ambiguity, Yakable should prefer explicit planning over hidden improvisation.

### Build should execute, not secretly re-plan

An approved plan is an execution contract. If it becomes invalid, return to planning explicitly.

### Observe reality

Do not assume generated or edited code produced the intended interface. Render it and observe the actual result.

### Evidence before critique

Critique should be grounded in what Yakable can actually observe. Missing evidence should stay unverified rather than becoming confident design claims.

### Bounded iteration

Automatic loops should have explicit limits and stopping rules. More retries are not automatically more intelligent.

### Specialized before general

Prefer deep frontend-specific capability over broad coding-agent feature parity.

## Non-goals

Yakable is not currently optimizing for:

- becoming a general autonomous coding agent
- unrestricted model-selected shell or tool execution
- multi-agent orchestration for its own sake
- copying every feature from Codex, Cursor, Lovable, or other builders
- a universal UI layout DSL
- infinite self-repair loops
- exposing hidden model reasoning to users

These may be reconsidered only when they directly improve the Frontend Harness.

## How to Use This File

`PLAN.md` defines product direction, architecture, current stage, and priorities.

It should not become a historical list of every merged capability or a permanent sequence of PR numbers.

Detailed implementation history belongs in pull requests, release notes, or capability documentation. Architecture details can move into dedicated docs as they become large enough to deserve their own source of truth.

When considering a new capability, ask:

1. Which layer does it belong to?
2. Does it strengthen the Frontend Harness?
3. Does it preserve Plan / Build boundaries?
4. Can its behavior be observed and tested?
5. Can it remain bounded before becoming more autonomous?
