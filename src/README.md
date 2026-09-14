# Yakable core source map

`src/` is organized by capability so the directory structure mirrors how Yakable works.

```text
src/
├── cli/                  # command-line entry points
├── model/                # model-provider adapters
├── modes/                # Plan / Build capability policy and mode-aware execution boundaries
├── planning/             # structured Plan Artifact drafting, rendering, persistence, and review
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

- **modes** owns the first-class `PLAN | BUILD` contract. Plan may read/search/observe/critique and now owns plan authoring/review capabilities, but it still cannot generate, edit, or repair project source. Build may read an approved plan and mutate source through the existing bounded path, but it cannot silently rewrite or approve/reject the Plan Artifact.
- **planning** owns the versioned Plan Artifact. A planning turn selects and reads bounded current project context, asks the planner for a compact structured artifact, validates all fields and current-file references, writes only `.yakable/plan.json` plus derived `.yakable/plan.md`, and supports explicit `DRAFT → APPROVED | REJECTED` review. A later planning turn creates a new draft revision; it does not mutate source.
- **prompt-intelligence** first answers whether dashboard input is CREATE, CHAT, or CLARIFY. Only CREATE continues into product intent, semantic defaults, taste translation, and Design Intent.
- **generation** answers: how do we turn normalized intent into a complete frontend source tree? It refuses a precomputed non-CREATE Build Intent decision, and source generation requires Build capability when a caller explicitly enters PLAN or BUILD mode.
- **editing** keeps frontend reasoning deliberately bounded. Frontend Agent v0 makes the existing workflow explicit as `SELECT_CONTEXT → READ → EDIT → CHECK → OBSERVE → CRITIQUE → REPAIR → DONE`; it is a deterministic state machine, not generic model-selected Tool calling. Context Selection still chooses at most 12 paths and Project Edit may modify only files it has read. The fixed project health check may run one build repair. Design Critic provides evidence-grounded PASS/FAIL output and Visual Repair may run exactly once.
- **runtime** safely runs generated projects, maps Preview elements back to source, and exposes one bounded page-observation snapshot. Page Observation v0 reports route, viewport/document dimensions, visible key elements with DOM/source metadata, and captured runtime errors. It does not take screenshots or dump full computed styles.
- **projects** owns generated-project parsing, `.yakable/project.json`, project listing, rename/star/remix/delete, and the project conversation/session repository.
- **templates** owns deterministic frontend foundations and optional Capability Packs. Base fixes the environment contract; packs may add only Yakable-owned UI primitives plus explicitly declared npm dependencies.
- **tools** defines the minimal `Tool`, `ToolResult`, `ToolContext`, and `ToolRegistry` contracts. `read_project_file`, `search_project`, and `check_project` stay bounded and never accept arbitrary shell commands.
- **storage** owns the local SQLite connection and schema only. It does not know planning, Prompt Intelligence, editing, or UI behavior.
- **model** owns provider-specific transport for intent analysis, generation, Plan Artifact drafting, Edit Intent normalization, Design Critic, focused editing, context selection, build repair, and Visual Repair. Capability modules should not know DeepSeek HTTP details.
- **server** exposes the existing JSON actions plus a narrow `agent-edit` NDJSON stream. Browser-only observation remains in the dashboard because the live DOM exists inside the Preview iframe.
- **cli** contains thin executable entry points. `npm run edit` runs the bounded Build path; `npm run plan` drafts, revises, shows, approves, or rejects Plan Artifacts without source mutation.

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
└── review-plan

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

`PLAN` is read-only with respect to project source by construction. Writing `.yakable/plan.json` / `.yakable/plan.md` is planning metadata, not source mutation. `BUILD` can consume plan metadata but cannot silently revise or approve/reject it.

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
└── plan.md            # derived human-readable review document
```

A new draft increments the revision and resets review state. Review is explicit: only `DRAFT` may transition to `APPROVED` or `REJECTED`. Plan history/diff is intentionally deferred to the later Re-plan / Plan Diff stage.

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
