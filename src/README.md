# Yakable core source map

`src/` is organized by capability so the directory structure mirrors how Yakable works.

```text
src/
├── cli/                  # command-line entry points
├── model/                # model-provider adapters
├── planning/             # Plan Artifact, UI Planner, Re-plan/Diff, and approved-plan execution
├── prompt-intelligence/  # gate build intent, then understand and normalize build requests
├── generation/           # turn normalized intent into a generated project
├── editing/              # bounded frontend agent states, edit, critique, and repair capabilities
├── runtime/              # run projects, instrument Preview, and observe bounded page state
├── projects/             # project files, metadata, sessions, and lifecycle actions
├── templates/            # deterministic Base + optional capability packs; no model selection
├── tools/                # small executable capabilities with structured results
├── storage/              # SQLite connection and schema
├── server/               # local Web API that connects product surfaces to capabilities
├── index.ts              # public exports
└── types.ts              # shared cross-capability contracts
```

## Capability boundaries

- **planning** owns the Plan Artifact, UI Planner, Re-plan / Plan Diff, and the approved-plan execution contract. A planning turn reads bounded current project context, UI Planner produces the semantic blueprint, and the Plan Artifact remains the reviewable source of truth. Re-plan archives the exact superseded revision before creating the next draft and computes a deterministic structural diff. After explicit approval, approved-plan execution compiles the reviewed artifact into an immutable execution snapshot and runs it through the bounded frontend edit/check path.
- **prompt-intelligence** first answers whether dashboard input is CREATE, CHAT, or CLARIFY. Only CREATE continues into product intent, semantic defaults, taste translation, and Design Intent.
- **generation** answers: how do we turn normalized intent into a complete frontend source tree? It refuses a precomputed non-CREATE Build Intent decision and owns no planning policy.
- **editing** keeps frontend reasoning deliberately bounded. Frontend Agent v0 makes the existing workflow explicit as `SELECT_CONTEXT → READ → EDIT → CHECK → OBSERVE → CRITIQUE → REPAIR → DONE`; it is a deterministic state machine, not generic model-selected Tool calling. Context Selection still chooses at most 12 paths and Project Edit may modify only files it has read. The fixed project health check may run one build repair. Approved-plan execution reuses these bounded primitives but supplies a separate reviewed execution contract and refuses silent deviation before source mutation.
- **runtime** safely runs generated projects, maps Preview elements back to source, and exposes one bounded page-observation snapshot. Page Observation v0 reports route, viewport/document dimensions, visible key elements with DOM/source metadata, and captured runtime errors. It does not take screenshots or dump full computed styles.
- **projects** owns generated-project parsing, `.yakable/project.json`, project listing, rename/star/remix/delete, and the project conversation/session repository.
- **templates** owns deterministic frontend foundations and optional Capability Packs. Base fixes the environment contract; packs may add only Yakable-owned UI primitives plus explicitly declared npm dependencies.
- **tools** defines the minimal `Tool`, `ToolResult`, `ToolContext`, and `ToolRegistry` contracts. `read_project_file`, `search_project`, and `check_project` stay bounded and never accept arbitrary shell commands.
- **storage** owns the local SQLite connection and schema only. It does not know planning, Prompt Intelligence, editing, or UI behavior.
- **model** owns provider-specific transport for intent analysis, generation, Plan Artifact drafting, UI Planner, Edit Intent normalization, Design Critic, focused editing, context selection, build repair, and Visual Repair. Plan Diff is deterministic and does not use a model.
- **server** exposes the existing JSON actions plus a narrow `agent-edit` NDJSON stream. Browser-only observation remains in the dashboard because the live DOM exists inside the Preview iframe.
- **cli** contains thin executable entry points. `npm run plan` drafts/re-plans/reviews/diffs Plan Artifacts; `npm run build:plan` executes the current approved revision through the bounded source-edit path; `npm run edit` remains the direct follow-up edit path.

`types.ts` stays at the root because its contracts are shared by several capabilities. `index.ts` stays at the root as the package-facing export boundary.

## Planning and source-mutation boundary

Planning and execution are capabilities, not global runtime modes.

- Planning APIs may read bounded project context and write planning metadata under `.yakable`.
- Source generation, editing, and repair happen through explicit mutation workflows.
- Approved-plan execution may consume reviewed plan metadata but cannot silently rewrite review state.
- Permission and approval policy belong to dedicated runtime boundaries rather than a Plan / Build switch.

## Plan Artifact v0 contract

The machine-readable artifact is intentionally small:

```text
Plan Artifact v1
├── revision
├── status: DRAFT | APPROVED | REJECTED
├── goal
├── context
│   ├── projectType
│   ├── relevantFiles
│   └── currentBehavior?
├── decisions[]
├── ui?                       # UI Planner v0 blueprint
├── implementation[]
├── validation[]
├── constraints[]
└── openQuestions[]
```

Current `context.relevantFiles` must be grounded in the bounded source snapshot supplied to the planner. Implementation steps may mention likely future project files, but the artifact never applies those changes itself.

Persistence lives beside generated-project metadata:

```text
generated/<project-id>/.yakable/
├── project.json
├── capabilities.json
├── plan.json                    # source of truth for the current revision
├── plan.md                      # derived human-readable current review document
└── plans/                       # superseded Re-plan baselines
    ├── revision-000001.json
    ├── revision-000001.md
    └── ...
```

A new draft increments the revision and resets review state. Review is explicit: only `DRAFT` may transition to `APPROVED` or `REJECTED`. The explicit Re-plan path archives the superseded revision before replacing `plan.json`.

## UI Planner v0 contract

UI Planner translates Design Intent plus the current planning request and bounded project evidence into one semantic interface blueprint. It returns either `PLANNED` or `NOT_APPLICABLE`.

```text
UI Plan v1
├── scope: PAGE | PROJECT
├── pageType
├── shell
│   ├── navigation: NONE | TOP | SIDEBAR | MIXED
│   ├── density: COMPACT | COMFORTABLE | SPACIOUS
│   └── contentWidth: NARROW | CONTAINED | FLUID
├── hierarchy
│   ├── primary
│   └── secondary[]
├── sections[]
│   ├── id
│   ├── title
│   ├── purpose
│   ├── priority: PRIMARY | SECONDARY
│   ├── pattern
│   └── content[]
├── responsive[]
└── deliberateOmissions[]
```

Section patterns are intentionally coarse: `HERO`, `STATS`, `TABLE`, `FORM`, `LIST`, `CARD_GRID`, `DETAIL`, `TOOLBAR`, `NAVIGATION`, or `CUSTOM`.

The blueprint is not a visual AST or layout DSL. UI Planner must not invent exact pixels, Tailwind classes, color values, font families, deeply nested component trees, or arbitrary breakpoints. It focuses on page type, shell, hierarchy, section composition, responsive behavior, and what should deliberately stay out.

A revision receives the previous UI blueprint as continuity context. If the new planning request has no meaningful UI consequence and UI Planner returns `NOT_APPLICABLE`, Yakable carries the existing blueprint forward rather than silently dropping it.

## Build From Approved Plan v0

Build does not execute arbitrary planning prose. It first compiles the current reviewed Plan Artifact into an immutable execution contract:

```text
Approved Plan
   ↓
validate APPROVED + reviewedAt
   ↓
reject unresolved openQuestions
   ↓
compile revision + fingerprint + reviewed decisions/UI/steps/constraints
   ↓
select bounded execution context
   ↓
EDIT
   ├── APPLIED → source mutation
   └── BLOCKED → report concrete deviations, mutate nothing
   ↓
CHECK
   ↓
one-shot build repair when required
```

The execution snapshot includes the exact approved revision and a short fingerprint so a Build run can identify which reviewed contract it executed. Existing source paths from the Plan Artifact are treated as context hints, but only files that still exist in the current project are read.

The project editor receives `approvedPlan` separately from derived Edit Intent. The reviewed plan wins on conflict. If faithful execution would require unread existing source, forbidden configuration/dependency changes, or a materially different UI/product direction, the model must return `BLOCKED` with explicit deviations rather than silently substituting a new plan.

One-shot build repair also receives the same approved execution contract and is restricted to repairing code health; it cannot redesign the reviewed plan.

The CLI surface is deliberately small:

```bash
npm run plan -- generated/<project-id> approve "Ready for Build"
npm run build:plan -- generated/<project-id>
```

Workspace Plan/Build controls and browser-side plan-aware visual verification are intentionally separate product work.

## Re-plan / Plan Diff v0

Re-plan is a first-class Plan operation rather than an implicit prompt convention:

```text
current revision rN
   ↓
archive rN under .yakable/plans
   ↓
read fresh bounded project evidence
   ↓
UI Planner + Plan Artifact
   ↓
new DRAFT rN+1
   ↓
deterministic structural diff
   ↓
review / approve
```

The diff does not ask a model what changed. It compares material plan fields deterministically: goal, context, decisions, UI shell/hierarchy/sections, implementation steps, validation, constraints, and open questions. Review metadata and timestamps are intentionally excluded from material plan comparison.

Diff status is one of `INITIAL`, `CHANGED`, `UNCHANGED`, or `BASELINE_MISSING`. Entries are bounded and use explicit `ADDED`, `REMOVED`, or `CHANGED` records with compact before/after values.

Starting a Re-plan replaces the current artifact with a new `DRAFT`. Because Build-from-approved-plan only executes the current `APPROVED` revision, requirements cannot change while an older approval continues to execute silently.

CLI examples:

```bash
npm run plan -- generated/<project-id> replan "Make failed tasks the primary hierarchy"
npm run plan -- generated/<project-id> diff
npm run plan -- generated/<project-id> diff 2 4
```

`revise` remains an alias for `replan`. Review output also includes the current revision diff when available.

## Frontend Agent v0 contract

```text
SELECT_CONTEXT
      ↓
     READ
      ↓
     EDIT
      ↓
     CHECK
      ↓
    OBSERVE
      ↓
   CRITIQUE
   ├── PASS ─────────────→ DONE
   └── FAIL
        ↓
      REPAIR   (at most once)
        ↓
      OBSERVE
        ↓
     CRITIQUE
        ↓
       DONE
```

Each state emits a structured event with `state`, `status`, `message`, `at`, and optional `iteration`. Progress describes execution state, not hidden model reasoning.

## Persistence model

```text
SQLite (`data/yakable.db`)          generated/<project-id>/
├── project session                 ├── .yakable/project.json
├── conversation/edit history      ├── .yakable/capabilities.json
└── Visual Edit source targets     ├── .yakable/plan.json
                                    ├── .yakable/plan.md
                                    ├── .yakable/plans/
                                    ├── src/
                                    └── public/
```

SQLite remains the source of truth for conversation/edit history. Generated project metadata, capability state, the current Plan Artifact, and superseded plan baselines stay with the generated project. Frontend Agent progress remains ephemeral.
