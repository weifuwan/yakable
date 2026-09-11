# Yakable

Yakable is being rebuilt one product problem at a time.

> One stage, one problem, one verifiable outcome.

## Stage 1 — Prompt → Code ✅

Turn one natural-language product prompt into a complete React + TypeScript + Vite source tree:

```bash
npm install
cp .env.example .env
# add DEEPSEEK_API_KEY to .env
npm run generate -- "Build a clean SaaS landing page"
```

Generated source is written under `generated/<project-id>/`.

## Stage 2 — Code → Run ✅

Run a generated project in Yakable's controlled local Vite runtime:

```bash
npm run run:project -- generated/<project-id>
```

Yakable prints a browser URL such as `http://127.0.0.1:5173/`. Generated npm scripts are not executed and dependencies are provided by Yakable's shared runtime.

## Stage 3 — Prompt → Patch 🚧

Stage 3 answers one new question:

> Can a second prompt modify the existing project without regenerating everything?

Edit an existing generated project with:

```bash
npm run edit -- generated/<project-id> "把 Hero 主色改成蓝色，并把标题改成 Yakable"
```

The Stage 3 flow is deliberately small:

```text
follow-up prompt + existing source
              ↓
           DeepSeek
              ↓
      changed files only
              ↓
        Yakable validation
              ↓
       overwrite those files
```

The model receives the current text project source, but `.env*`, `node_modules`, `dist`, `.git`, and `.yakable` content is excluded. It must return complete contents only for files that need to change.

### Stage 3 write boundary

Stage 3 may modify or create:

- `src/**`
- `public/**`
- `index.html`

It cannot modify `package.json`, lockfiles, environment files, Vite configuration, or other root configuration. File deletion and new npm dependencies are intentionally deferred.

Stage 3 does **not** automatically run the project after editing. To inspect the result, run Stage 2 again:

```bash
npm run run:project -- generated/<project-id>
```

### Explicitly out of scope

Stage 3 does not add:

- Agent tool calling or a multi-step Agent loop
- automatic runtime/build repair
- AI retries after errors
- file deletion
- arbitrary npm dependency changes
- project versions / rollback
- database / auth / backend
- deployment
- an embedded web Preview workspace

Automatic `Patch → Run → Error → Fix` belongs to Stage 4.

## DeepSeek request controls

```env
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_TIMEOUT_MS=600000
DEEPSEEK_MAX_TOKENS=16384
DEEPSEEK_THINKING=disabled
```

## Checks

```bash
npm run typecheck
npm test
```

## Current flow

```text
Prompt → Code ✅
Code → Run ✅
Prompt → Patch 🚧
Error → Fix ⏭️
```
