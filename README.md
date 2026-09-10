# Yakable

Yakable is an AI app builder focused on the shortest useful loop: describe a product, let a coding agent generate the source, run it in a controlled preview runtime, then keep refining it through chat.

## MVP progress

- ✅ PR 1 — React workspace shell with Chat + Preview
- ✅ PR 2 — server-side AI Provider boundary + bounded Agent loop
- ✅ PR 3 — generated React/Vite/Tailwind project workspace + file tools
- 🚧 PR 4 — controlled Preview Runtime + real generated-app iframe
- ⏭️ PR 5 — multi-turn incremental edits + stronger runtime feedback

## What PR 4 adds

Yakable can now take the generated project source and run it as a real browser Preview:

- materialize each generated project into its own runtime directory
- start a dedicated Vite middleware runtime for that project
- reuse Yakable's fixed React/Vite/Tailwind dependencies instead of allowing arbitrary package installation
- automatically synchronize the runtime after every Agent turn
- expose the generated app through `/preview/:projectId/`
- proxy `/preview` through the local Web dev server
- render the generated app inside a sandboxed iframe
- apply a Preview-only CSP and restrictive browser sandbox flags
- distinguish source-generation success from runtime startup failure
- cap active runtimes and sweep idle runtime directories
- expose a manual runtime refresh endpoint and UI action

The Agent still cannot execute arbitrary shell commands and cannot modify the locked root configuration. That keeps the first live-runtime slice reproducible and sharply limits the execution surface.

## Local development

```bash
npm install
cp .env.example .env   # optional: configure Anthropic
npm run dev:api        # terminal 1
npm run dev:web        # terminal 2
```

Open `http://localhost:5173` and describe an app. Without `ANTHROPIC_API_KEY`, Yakable uses the deterministic mock provider, so the complete inspect → plan → read → write → preview flow is still testable.

Generated runtime files are written under `.yakable/runtime/` by default. Override that path with `YAKABLE_RUNTIME_ROOT` if needed.

## Checks

```bash
npm run typecheck
npm run test:agent
npm run build
```

## Security boundary

PR 4 is an **MVP Preview Runtime**, not a production-grade container or microVM sandbox. Generated React source is transformed by a fixed Vite runtime and executed in a browser iframe with sandbox/CSP restrictions; user prompts do not become shell commands and project configuration remains locked.

Before running untrusted multi-tenant workloads on the public internet, the same runtime interface should be backed by a dedicated container/microVM boundary and a separate Preview origin. The Web and Agent contracts in this PR are designed so that upgrade does not require a product rewrite.
