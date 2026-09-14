# Yakable core source map

`src/` is organized by capability so the directory structure mirrors how Yakable works.

```text
src/
├── cli/                  # command-line entry points
├── model/                # model-provider adapters
├── prompt-intelligence/  # understand and normalize the user's request
├── generation/           # turn normalized intent into a generated project
├── editing/              # apply focused edits to an existing project
├── runtime/              # run projects and instrument Preview
├── projects/             # project files, metadata, sessions, and lifecycle actions
├── storage/              # SQLite connection and schema
├── server/               # local Web API that connects product surfaces to capabilities
├── index.ts              # public exports
└── types.ts              # shared cross-capability contracts
```

## Capability boundaries

- **prompt-intelligence** answers: what does the user mean, what can be safely inferred, what visual direction should be respected, and what remains unresolved?
- **generation** answers: how do we turn that normalized intent into a complete frontend source tree?
- **editing** answers: how do we apply one requested change to an existing generated project without rewriting unrelated code?
- **runtime** answers: how do we safely run the generated project and map Preview elements back to source?
- **projects** owns generated-project parsing, `.yakable/project.json`, project listing, rename/star/remix/delete, and the project conversation/session repository.
- **storage** owns the local SQLite connection and schema only. It does not know Prompt Intelligence, editing, or UI behavior.
- **model** owns provider-specific transport. Prompt Intelligence, generation, and editing should not know DeepSeek HTTP details.
- **server** wires these capabilities into the local API. It should orchestrate them rather than reimplement their logic.
- **cli** contains thin executable entry points only.

`types.ts` stays at the root because its contracts are shared by several capabilities. `index.ts` stays at the root as the package-facing export boundary.

## Persistence model

Yakable keeps two kinds of local state separate:

```text
SQLite (`data/yakable.db`)          generated/<project-id>/
├── project session                 ├── src/
├── conversation/edit history      ├── public/
└── Visual Edit source targets     └── project source files
```

SQLite is the source of truth for conversation and edit history. Existing projects with a legacy `.yakable/session.json` are imported into SQLite on first read, so older local projects remain compatible.
