# Yakable core source map

`src/` is organized by capability so the directory structure mirrors how Yakable works.

```text
src/
├── cli/                  # command-line entry points
├── model/                # model-provider adapters
├── modes/                # Plan / Build capability policy and mode-aware execution boundaries
├── planning/             # Plan Artifact, UI Planner, approval, and approved-plan execution contract
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

- **modes** owns the first-class `PLAN | BUILD` contract. Plan may read/search/observe/critique, author/review Plan metadata, and run UI Planner. It still cannot generate, edit, or repair project source. Build may read an approved plan and mutate source through the bounded execution path, but it cannot silently rewrite, review, or re-plan it.
- **planning** owns the Plan Artifact, UI Planner, and the approved-plan execution contract. A planning turn selects and reads bounded current project context once, runs UI Planner against that same evidence, then gives the semantic UI blueprint to the Plan Artifact planner. After explicit approval, Build compiles the reviewed artifact into an immutable execution snapshot and runs it through the bounded frontend edit/check path. Planning metadata stays under `.yakable`; source mutation still happens only in Build.
- **prompt-intelligence** first answers whether dashboard input is CREATE, CHAT, or CLARIFY. Only CREATE continues into product intent, semantic defaults, taste translation, and Design Intent.
- **generation** answers: how do we turn normalized intent into a complete frontend source tree? It refuses a precomputed non-CREATE Build Intent decision, and source generation requires Build capability when a caller explicitly enters PLAN or BUILD mode.
- **editing** keeps frontend reasoning deliberately bounded. Frontend Agent v0 makes the existing workflow explicit as `SELECT_CONTEXT → READ → EDIT → CHECK → OBSERVE → CRITIQUE → REPAIR → DONE`; it is a deterministic state machine, not generic model-selected Tool calling. Context Selection still chooses at most 12 paths and Project Edit may modify only files it has read. The fixed project health check may run one build repair. Approved-plan execution reuses these bounded primitives but supplies a separate reviewed execution contract and refuses silent deviation before source mutation.
- **runtime** safely runs generated projects, maps Preview elements back to source, and exposes one bounded page-observation snapshot. Page Observation v0 reports route, viewport/document dimensions, visible key elements with DOM/source metadata, and captured runtime errors. It does not take screenshots or dump full computed styles.
- **projects** owns generated-project parsing, `.yakable/project.json`, project listing, rename/star/remix/delete, and the project conversation/session repository.
- **templates** owns deterministic frontend foundations and optional Capability Packs. Base fixes the environment contract; packs may add only Yakable-owned UI primitives plus explicitly declared npm dependencies.
- **tools** defines the minimal `Tool`, `ToolResult`, `ToolContext`, and `ToolRegistry` contracts. `read_project_file`, `search_project`, and `check_project` stay bounded and never accept arbitrary shell commands.
- **storage** owns the local SQLite connection and schema only. It does not know planning, Prompt Intelligence, editing, or UI behavior.
- **model** owns provider-specific transport for intent analysis, generation, Plan Artifact drafting, UI Planner, Edit Intent normalization, Design Critic, focused editing, context selection, build repair, and Visual Repair. Capability modules should not know DeepSeek HTTP details.
- **server** exposes the existing JSON actions plus a narrow `agent-edit` NDJSON stream. Browser-only observation remains in the dashboard because the live DOM exists inside the Preview iframe.
- **cli** contains thin executable entry points. `npm run plan` drafts/revises/reviews Plan Artifacts without source mutation; `npm run build:plan` executes the current approved revision through the bounded Build path; `npm run edit` remains the direct follow-up edit path.

`types.ts` stays at the root because its contracts are shared by several capabilities. `index.ts` stays at the root as the package-facing export boundary.

## Plan / Build Mode v0 contract

The mode contract is permission-oriented:

```text
PLAN
├── read-project
├── search-project
├── observe-preview
├── critique-design
├── read-plan
├── write-plan
├── review-plan
└── plan-ui

BUILD
├── read-project
├── search-project
├── observe-preview
├── critique-design
├── read-plan
├── generate-source
├── edit-source
└── repair-source
```

`PLAN` is read-only with respect to project source by construction. Writing `.yakable/plan.json` / `.yakable/plan.md` is planning metadata, not source mutation. `BUILD` can consume plan metadata but cannot silently revise, approve/reject, or re-plan it.

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
├── plan.json          # source of truth for the current plan revision
└── plan.md            # derived human-readable review document, including UI blueprint
```

A new draft increments the revision and resets review state. Review is explicit: only `DRAFT` may transition to `APPROVED` or `REJECTED`. Plan history/diff is intentionally deferred to the later Re-plan / Plan Diff stage.

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
                                    ├── src/
                                    └── public/
```

SQLite remains the source of truth for conversation/edit history. Generated project metadata, capability state, and the current Plan Artifact stay with the generated project. Frontend Agent progress remains ephemeral.
