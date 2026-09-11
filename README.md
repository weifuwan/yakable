# Yakable

Yakable is being rebuilt one product problem at a time.

> One stage, one problem, one verifiable outcome.

## Web product flow

The Lovable-inspired dashboard is now wired to the Stage 1–3 backend capabilities.

Run the local API in one terminal:

```bash
npm install
npm run dev:api
```

Run the dashboard in another terminal:

```bash
npm run dev:web
```

Open `http://127.0.0.1:5173/`.

The web flow is now:

```text
Dashboard Prompt
      ↓
Prompt → Code
      ↓
Code → Run
      ↓
Project Workspace + live iframe Preview
      ↓
Follow-up Prompt → Patch
      ↓
Preview refresh
```

The API listens only on `127.0.0.1:8787` by default and the dashboard proxies `/api` to it. Set `YAKABLE_API_PORT` only if you also update the dashboard Vite proxy.

### What works in the browser

- create a new project from the dashboard prompt
- generate the Stage 1 source tree with DeepSeek
- start the Stage 2 controlled Vite runtime automatically
- enter a Lovable-style split workspace with chat on the left and Preview on the right
- reopen existing local projects from the dashboard
- send follow-up edit prompts using the Stage 3 patch flow
- refresh or open the live Preview separately

### Boundary

This is still **not Stage 4**. The browser does not feed build/runtime failures back into DeepSeek and does not run an automatic repair loop. If a patch breaks the generated project, the Preview exposes that failure and repair remains manual for now.

There is also no auth, database, cloud persistence, deployment, or multi-tenant sandbox yet. The Web API and generated runtimes are local development surfaces.

## CLI stages

The original stage commands remain available:

```bash
npm run generate -- "Build a clean SaaS landing page"
npm run run:project -- generated/<project-id>
npm run edit -- generated/<project-id> "把 Hero 主色改成蓝色"
```

DeepSeek request controls:

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
Dashboard → real product flow ✅
Error → Fix ⏭️
```
