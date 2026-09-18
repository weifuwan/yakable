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

Yakable separates planning from source mutation through explicit capability boundaries.

### Planning

Planning is for **understanding, exploring, deciding, and reviewing**.

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

The primary output of planning is an explicit, reviewable **Plan Artifact**.

### Execution

Execution is for **applying an approved intent or plan to project source**.

It may:

- select focused context
- read and search source
- edit project files inside bounded scope
- run deterministic project checks
- render the project
- observe the Preview
- critique the rendered result
- perform bounded repair

Execution should not silently redefine an approved plan. When execution discovers that the plan is no longer valid, Yakable should stop or return to planning instead of hiding a new plan inside implementation.

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
                      PLANNING
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
                     EXECUTION
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

Planning and execution should share one frontend-specific intelligence layer.

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

Planning produces structured data internally, not only free-form Markdown.

Plan Artifact v0 remains deliberately small and attaches the dedicated UI Planner blueprint when UI planning is applicable:

```ts
interface YakablePlan {
  version: 1;
  revision: number;
  status: "DRAFT" | "APPROVED" | "REJECTED";
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
    files: string[];
  }>;

  validation: string[];
  constraints: string[];
  openQuestions: string[];

  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}
```

The current source of truth is `.yakable/plan.json`; `.yakable/plan.md` is a derived human-readable review document. Current `context.relevantFiles` must be grounded in the bounded project snapshot supplied to the planner.

A planning turn may revise the current artifact by creating the next `DRAFT` revision. Review is explicit: only a draft may transition to `APPROVED` or `REJECTED`. Build may read plan metadata but cannot silently rewrite, review, or re-plan it.

Superseded revisions are preserved under `.yakable/plans/` by the explicit Re-plan path so reviewed decisions remain traceable after the current plan advances.

## UI Planner

UI Planner is a planning capability, not a separate runtime mode.

UI Planner v0 runs against the same bounded project context used by the Plan Artifact and produces either `PLANNED` or `NOT_APPLICABLE`. When applicable, the blueprint is attached to the Plan Artifact as `ui` before review.

The blueprint is intentionally semantic rather than a layout DSL:

```ts
interface UIPlan {
  version: 1;
  scope: "PAGE" | "PROJECT";
  pageType: string;

  shell: {
    navigation: "NONE" | "TOP" | "SIDEBAR" | "MIXED";
    density: "COMPACT" | "COMFORTABLE" | "SPACIOUS";
    contentWidth: "NARROW" | "CONTAINED" | "FLUID";
  };

  hierarchy: {
    primary: string;
    secondary: string[];
  };

  sections: Array<{
    id: string;
    title: string;
    purpose: string;
    priority: "PRIMARY" | "SECONDARY";
    pattern: "HERO" | "STATS" | "TABLE" | "FORM" | "LIST" |
             "CARD_GRID" | "DETAIL" | "TOOLBAR" | "NAVIGATION" | "CUSTOM";
    content: string[];
  }>;

  responsive: string[];
  deliberateOmissions: string[];
}
```

UI Planner v0 is responsible for:

- page/product-surface type
- shell and navigation direction
- information hierarchy
- section composition and pattern choice
- meaningful responsive behavior
- deliberate omissions that keep the interface focused

It intentionally does not encode exact pixels, Tailwind classes, color values, font families, deeply nested component trees, coordinates, or a constraint graph. Those details remain implementation concerns unless the human explicitly specifies them.

When revising a Plan Artifact, the previous UI blueprint is continuity context. A non-UI planning revision preserves the current blueprint instead of silently discarding it.

## Build From Approved Plan

An approved plan is now an execution contract, not just review prose.

Before source mutation, Build compiles the current Plan Artifact into a bounded immutable snapshot containing:

- approved revision and approval timestamp
- a short fingerprint of the reviewed artifact
- goal and product context
- explicit decisions
- UI blueprint when present
- implementation steps
- validation expectations
- constraints

Build refuses non-approved plans, plans without review metadata, plans with unresolved blocking `openQuestions`, or plans without implementation steps.

Existing source paths from the approved plan become context hints, but Build still reads only current files selected inside the normal bounded context limit. The compiled contract is passed separately from derived Edit Intent so the model cannot treat a later interpretation as permission to rewrite the reviewed plan.

Approved-plan editing has two model outcomes:

```text
APPLIED
└── deviations: []
    └── bounded source changes

BLOCKED
└── concrete deviations[]
    └── no source mutation
```

If faithful execution would require a materially different UI/product direction, unread existing source, forbidden configuration/dependency changes, or another violation of the execution boundary, Yakable stops and surfaces the deviation instead of silently substituting a new plan.

The fixed project health check still runs after source mutation. Its one-shot build repair receives the same approved execution contract and may repair code health only; it cannot redesign the reviewed plan.

This v0 path is available through `npm run build:plan -- generated/<project-id>`. Workspace Plan/Build controls and browser-side plan-aware visual verification remain separate product work.

## Re-plan / Plan Diff

Re-plan is explicit instead of silently replacing an approved decision set during Build.

```text
Current Plan rN
      ↓
archive exact superseded revision
      ↓
read current bounded project evidence again
      ↓
UI Planner + Plan Artifact revision
      ↓
new DRAFT rN+1
      ↓
deterministic Plan Diff
      ↓
review / approve before execution
```

The current revision remains `.yakable/plan.json`. Superseded revisions are archived as JSON plus derived Markdown under:

```text
.yakable/plans/
├── revision-000001.json
├── revision-000001.md
├── revision-000002.json
└── revision-000002.md
```

Plan Diff is deterministic rather than model-generated. It compares material planning fields such as goal, context, decisions, UI shell/hierarchy/sections, implementation steps, validation, constraints, and open questions. Review metadata and timestamps are not treated as product-plan changes.

Diff status is explicit:

```text
INITIAL           first revision
CHANGED           one or more material fields changed
UNCHANGED         new revision is materially equivalent
BASELINE_MISSING  an older migrated baseline is unavailable
```

Starting a Re-plan produces a new `DRAFT`, so the existing Build-from-approved-plan path will refuse execution until that new revision is reviewed and approved. This prevents an older approval from being silently reused after requirements changed.

The v0 CLI surface is:

```bash
npm run plan -- generated/<project-id> replan "Change the dashboard hierarchy"
npm run plan -- generated/<project-id> diff
npm run plan -- generated/<project-id> diff 2 4
```

`revise` remains an alias for `replan`. Approve/reject output also includes the latest visible Plan Diff when available.

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

## Capability Boundaries

Yakable no longer uses a global Plan / Build runtime mode.

Planning, generation, editing, review, and approved-plan execution are explicit capabilities with separate APIs and workflow ownership. The boundary is structural:

- planning operations may update Plan metadata and revision history;
- source-changing operations are explicit generation/edit/repair workflows;
- approved-plan execution consumes reviewed decisions but does not rewrite them;
- tool permission and user approval should be enforced by dedicated permission/runtime policy when those capabilities require it.

This keeps ownership visible without carrying a global mode flag through every layer.

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
- bounded planning APIs with reviewable Plan Artifacts and no runtime mode switch
- versioned Plan Artifact drafting, Markdown rendering, persistence, and explicit review state
- UI Planner v0 with a bounded semantic UI blueprint attached to the Plan Artifact
- Build From Approved Plan with immutable execution snapshots, plan-aware source editing, explicit BLOCKED deviations, and plan-preserving build repair
- Re-plan / Plan Diff v0 with archived superseded revisions and deterministic structural revision comparison

These capabilities are foundations, not the roadmap itself.

## Current Stage

```text
Stage A — Understand          ✅
Stage B — Build               ✅
Stage C — Observe             ✅
Stage D — Evaluate & Repair   ✅
Stage E — Plan                ✅
Stage F — Taste Intelligence  ← CURRENT
Stage G — Extensible Tools
Stage H — Production
```

## Completed Stage E — Plan

Goal: **separate decision-making from source mutation and make frontend decisions reviewable before execution.**

1. **Planning / Execution Boundary** ✅
   - keep planning and source mutation as separate capability paths
   - enforce boundaries through explicit APIs and workflow contracts
   - keep planning operations focused on plan metadata rather than project-source mutation

2. **Plan Artifact + Review** ✅
   - define a small versioned structured Plan Artifact
   - draft it from bounded read/search project context
   - persist machine-readable JSON plus derived review Markdown
   - allow explicit approve / reject transitions before execution

3. **UI Planner v0** ✅
   - compile Design Intent and bounded project evidence into a small semantic UI blueprint
   - attach page type, shell, hierarchy, sections, responsive guidance, and deliberate omissions
   - preserve previous UI decisions across non-UI revisions

4. **Build From Approved Plan** ✅
   - compile an approved artifact into one immutable execution snapshot
   - execute through the bounded Frontend Agent edit/check path
   - preserve reviewed decisions and stop on explicit deviations instead of silently re-planning

5. **Re-plan / Plan Diff v0** ✅
   - archive the superseded revision before creating the next draft
   - reread current bounded project evidence during Re-plan
   - make material revision changes deterministic and visible before approval / execution
   - keep older approved decisions traceable instead of replacing them invisibly

## Current Focus — Stage F: Taste Intelligence

Goal: **make frontend taste reusable, retrievable, and testable instead of leaving it embedded in one-off prompt interpretation.**

Near-term work should focus on outcomes rather than permanent PR numbering:

1. **Taste Library + Retrieval** ← NEXT
   - define a small frontend taste knowledge unit
   - retrieve only relevant taste / pattern examples for the current product and UI context
   - keep retrieval evidence visible to planning rather than turning it into hidden style magic

2. **Design Direction Suggestions**
   - generate a few distinct, bounded design directions when the user has not specified one
   - let the user select or revise a direction before execution when the decision materially affects the interface

3. **Component / Pattern Knowledge**
   - reuse proven frontend composition patterns without hard-coding complete page templates
   - connect pattern knowledge to UI Planner section choices and deliberate omissions

4. **Design-System-aware Planning**
   - let Plan/UI Planner understand existing tokens, primitives, and component constraints
   - prefer the project's own design language over generic generated styling

5. **Critic Calibration + Better Visual Evidence**
   - improve what Yakable can reliably verify after rendering
   - add richer visual evidence only where it materially improves grounded critique

## Next Stages

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

### Execution should follow reviewed decisions, not secretly re-plan

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
3. Does it preserve capability ownership and source-mutation boundaries?
4. Can its behavior be observed and tested?
5. Can it remain bounded before becoming more autonomous?
