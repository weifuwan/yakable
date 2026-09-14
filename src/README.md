# Yakable core source map

`src/` is organized by capability so the directory structure mirrors how Yakable works.

```text
src/
├── cli/                  # command-line entry points
├── model/                # model-provider adapters
├── prompt-intelligence/  # gate build intent, then understand and normalize build requests
├── generation/           # turn normalized intent into a generated project
├── editing/              # select/search context, edit, check, and at most one repair
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

- **prompt-intelligence** first answers whether dashboard input is CREATE, CHAT, or CLARIFY. Only CREATE continues into product intent, semantic defaults, taste translation, and Design Intent.
- **generation** answers: how do we turn that normalized intent into a complete frontend source tree? It also refuses a precomputed non-CREATE Build Intent decision, so callers cannot bypass the gate accidentally.
- **editing** keeps the edit loop deliberately bounded. It selects at most 12 relevant paths, may request exactly one literal project-text search, reads only the focused context, applies one user edit, and runs `check_project`. A PASS ends immediately. A FAIL may trigger exactly one repair using a new bounded context prioritized from initially changed files, diagnostic paths, and the original edit context. The repair can modify only those files, then `check_project` runs exactly once more and editing stops whether the result passes or fails. Source-mapped Visual Edit targets still bypass context-model selection and search.
- **runtime** answers: how do we safely run the generated project, map Preview elements back to source, and expose one bounded page-observation snapshot? Page Observation v0 is request/response only: it reports route, viewport/document dimensions, up to 80 visible key elements with DOM/source metadata, and up to 12 captured runtime errors. It does not take screenshots, call a model, critique design, or repair source.
- **projects** owns generated-project parsing, `.yakable/project.json`, project listing, rename/star/remix/delete, and the project conversation/session repository.
- **templates** owns deterministic frontend foundations and optional Capability Packs. Base fixes the environment contract; packs may add only Yakable-owned UI primitives plus explicitly declared npm dependencies. This layer does not choose packs with a model.
- **tools** defines the minimal `Tool`, `ToolResult`, `ToolContext`, and `ToolRegistry` contracts. `read_project_file` reads one safe UTF-8 project file. `search_project` performs one bounded case-insensitive literal search across caller-supplied readable candidate paths and returns only source locations/snippets. `check_project` runs Yakable's fixed TypeScript and Vite health checks and returns structured PASS/FAIL diagnostics; it cannot accept arbitrary commands and never changes source. There is still no generic model tool-calling or MCP adapter.
- **storage** owns the local SQLite connection and schema only. It does not know Prompt Intelligence, editing, or UI behavior.
- **model** owns provider-specific transport for intent analysis, generation, focused editing, context selection, and the single repair request. Capability modules should not know DeepSeek HTTP details.
- **server** wires these capabilities into the local API. It should orchestrate them rather than reimplement their logic.
- **cli** contains thin executable entry points only, including a standalone `check:project` command for testing project health without invoking the model.

`types.ts` stays at the root because its contracts are shared by several capabilities. `index.ts` stays at the root as the package-facing export boundary.

## Persistence model

Yakable keeps two kinds of local state separate:

```text
SQLite (`data/yakable.db`)          generated/<project-id>/
├── project session                 ├── .yakable/project.json
├── conversation/edit history      ├── .yakable/capabilities.json
└── Visual Edit source targets     ├── src/
                                    └── public/
```

SQLite is the source of truth for conversation and edit history. Generated project metadata and installed capability state stay with the generated project.
