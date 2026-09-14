# Yakable core source map

`src/` is organized by capability so the directory structure mirrors how Yakable works.

```text
src/
├── cli/                  # command-line entry points
├── model/                # model-provider adapters
├── modes/                # Plan / Build capability policy and mode-aware execution boundaries
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

- **modes** owns the first-class `PLAN | BUILD` contract. Plan exposes only read/search/observe/critique capabilities. Build adds source generation, source editing, and source repair. Mode checks are explicit capability checks, not prompt instructions. Public mode-aware mutation helpers assert the policy before delegating to existing bounded editing/repair capabilities. Existing product flows remain BUILD by default in v0 for backward compatibility; Plan UI and Plan Artifact orchestration come later.
- **prompt-intelligence** first answers whether dashboard input is CREATE, CHAT, or CLARIFY. Only CREATE continues into product intent, semantic defaults, taste translation, and Design Intent.
- **generation** answers: how do we turn that normalized intent into a complete frontend source tree? It refuses a precomputed non-CREATE Build Intent decision, and source generation now also requires Build capability when a caller explicitly enters PLAN or BUILD mode.
- **editing** keeps frontend reasoning deliberately bounded. Frontend Agent v0 makes the existing workflow explicit as `SELECT_CONTEXT → READ → EDIT → CHECK → OBSERVE → CRITIQUE → REPAIR → DONE`; it is a deterministic state machine, not generic model-selected Tool calling. Edit Intent Delta still normalizes the current human request against the persisted original Design Intent. Context Selection still chooses at most 12 paths and Project Edit may modify only files it has read. The fixed project health check may run one build repair. After a healthy edit, the browser owns `OBSERVE` because the live DOM exists inside the Preview iframe. Design Critic provides evidence-grounded PASS/FAIL output. A FAIL may enter `REPAIR` exactly once, using only bounded source context derived from critic evidence, the just-changed files, and the original selected context. A healthy visual repair is observed and critiqued once more; the next state is always `DONE` even if issues remain.
- **runtime** answers: how do we safely run the generated project, map Preview elements back to source, and expose one bounded page-observation snapshot? Page Observation v0 is request/response only: it reports route, viewport/document dimensions, up to 80 visible key elements with DOM/source metadata, and up to 12 captured runtime errors. It does not take screenshots or dump full computed styles.
- **projects** owns generated-project parsing, `.yakable/project.json`, project listing, rename/star/remix/delete, and the project conversation/session repository.
- **templates** owns deterministic frontend foundations and optional Capability Packs. Base fixes the environment contract; packs may add only Yakable-owned UI primitives plus explicitly declared npm dependencies. This layer does not choose packs with a model.
- **tools** defines the minimal `Tool`, `ToolResult`, `ToolContext`, and `ToolRegistry` contracts. `read_project_file` reads one safe UTF-8 project file. `search_project` performs one bounded case-insensitive literal search across caller-supplied readable candidate paths and returns only source locations/snippets. `check_project` runs Yakable's fixed TypeScript and Vite health checks and returns structured PASS/FAIL diagnostics; it cannot accept arbitrary commands and never changes source. There is still no generic model tool-calling or MCP adapter.
- **storage** owns the local SQLite connection and schema only. It does not know Prompt Intelligence, editing, or UI behavior.
- **model** owns provider-specific transport for intent analysis, generation, Edit Intent normalization, Design Critic, focused editing, context selection, build repair, and Visual Repair. Capability modules should not know DeepSeek HTTP details.
- **server** exposes the existing JSON actions plus a narrow `agent-edit` NDJSON stream. Only the backend-owned `SELECT_CONTEXT`, `READ`, `EDIT`, and `CHECK` states are streamed there. The dashboard continues the same run through browser-owned `OBSERVE`, `CRITIQUE`, optional `REPAIR`, and `DONE` states and surfaces them in the Workspace progress UI.
- **cli** contains thin executable entry points only. `npm run edit` prints the backend-owned Frontend Agent states live; browser-only observation and critique still require the Workspace Preview.

`types.ts` stays at the root because its contracts are shared by several capabilities. `index.ts` stays at the root as the package-facing export boundary.

## Plan / Build Mode v0 contract

The mode contract is intentionally small and permission-oriented:

```text
PLAN
├── read-project
├── search-project
├── observe-preview
└── critique-design

BUILD
├── everything in PLAN
├── generate-source
├── edit-source
└── repair-source
```

`PLAN` is therefore read-only with respect to project source by construction at the mode-aware execution boundary. `BUILD` preserves the current bounded mutation path. The default remains `BUILD` in v0 so existing API/CLI/dashboard behavior does not change before the Plan Artifact and Plan UI exist.

The contract does not yet introduce a Plan workspace, approval UI, or Plan Artifact persistence. Those belong to the next planning stage rather than being simulated by a mode toggle with no planning product behind it.

## Frontend Agent v0 contract

The state machine is intentionally small:

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

Each state emits a structured event with `state`, `status`, `message`, `at`, and optional `iteration`. Repeated events are status updates for the same state, not hidden reasoning. The transition contract prevents a second Visual Repair cycle in v0.

## Persistence model

Yakable keeps two kinds of local state separate:

```text
SQLite (`data/yakable.db`)          generated/<project-id>/
├── project session                 ├── .yakable/project.json
├── conversation/edit history      ├── .yakable/capabilities.json
└── Visual Edit source targets     ├── src/
                                    └── public/
```

SQLite is the source of truth for conversation and edit history. Generated project metadata and installed capability state stay with the generated project. Frontend Agent progress events are intentionally ephemeral in v0 and are not stored as conversation messages.
