# Yakable

Yakable is being rebuilt one product problem at a time.

> One stage, one problem, one verifiable outcome.

## Dashboard UI shell

Yakable now includes a Lovable-inspired dashboard shell so the product can start taking shape before the Stage 4 Agent loop.

```bash
npm install
npm run dev:web
```

Open `http://127.0.0.1:5173/`.

The dashboard is intentionally UI-only for now. It includes the sidebar navigation, gradient creation hero, prompt composer, project filters, and project cards. Submitting the composer does not call DeepSeek yet; wiring the web product flow is a separate change.

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

## Stage 3 — Prompt → Patch ✅

Edit an existing generated project with:

```bash
npm run edit -- generated/<project-id> "把 Hero 主色改成蓝色，并把标题改成 Yakable"
```

The model receives the current text project source and returns only the complete contents of changed files. Stage 3 can modify `src/**`, `public/**`, and `index.html`, while package and root configuration remain locked.

Stage 3 does **not** automatically run the project after editing. To inspect the result, run Stage 2 again:

```bash
npm run run:project -- generated/<project-id>
```

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
npm run build:web
```

## Current flow

```text
Prompt → Code ✅
Code → Run ✅
Prompt → Patch ✅
Dashboard UI ✅
Error → Fix ⏭️
```
