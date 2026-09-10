# Yakable

Yakable is an AI app builder focused on the shortest useful loop: describe a product, let a coding agent generate the source, then run and refine it in an isolated preview environment.

## MVP progress

- ✅ PR 1 — React workspace shell with Chat + Preview
- ✅ PR 2 — server-side AI Provider boundary + bounded Agent loop
- 🚧 PR 3 — generated React/Vite/Tailwind project workspace + file tools
- ⏭️ PR 4 — Sandbox runtime + real live Preview

## What PR 3 adds

The Agent can now do real implementation work against a generated project workspace:

- deterministically scaffold React + TypeScript + Vite + Tailwind CSS
- inspect and list generated project files
- read existing source files
- create or replace files under `src/` and `public/`
- keep root build configuration locked so the MVP stack stays reproducible
- return project file metadata and changed-file information to the Web workspace

Generated projects are stored in an **in-memory server workspace** for this MVP slice. They are source workspaces, not running containers yet. Project count, source size, file size and path traversal are bounded before Sandbox work begins.

## Local development

```bash
npm install
cp .env.example .env   # optional: configure Anthropic
npm run dev:api        # terminal 1
npm run dev:web        # terminal 2
```

Open `http://localhost:5173` and describe an app. Without `ANTHROPIC_API_KEY`, Yakable uses the deterministic mock provider so the complete inspect → plan → read → write Agent path is still testable.

## Checks

```bash
npm run typecheck
npm run test:agent
npm run build
```

## Current boundary

PR 3 intentionally does **not** execute generated code, install project dependencies, or claim that the visual Preview reflects the generated source. PR 4 will mount this project workspace into a Sandbox and make the Preview real.
