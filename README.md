# Yakable

Yakable is being rebuilt one product problem at a time.

> One capability, one problem, one verifiable outcome.

## Web product flow

The Lovable-inspired dashboard is wired to Yakable's prompt intelligence, project generation, runtime, preview, and editing capabilities.

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
Prompt Intelligence
      ↓
Design Intent
      ↓
Generate Project
      ↓
Run + live Preview
      ↓
Follow-up Prompt → Edit
      ↓
Preview refresh
```

The API listens on `127.0.0.1:8787` by default and the dashboard proxies `/api` to it. Set `YAKABLE_API_PORT` only if you also update the dashboard Vite proxy.

### What works in the browser

- create a new project from the dashboard prompt
- analyze the request through Intent Parser, Semantic Expander, Taste Translator, and Design Intent IR
- generate the frontend source tree with DeepSeek
- start the controlled Vite runtime automatically
- enter a Lovable-style split workspace with chat on the left and Preview on the right
- reopen existing local projects from the dashboard
- send follow-up edit prompts against the existing project
- select Preview elements and target edits back to mapped JSX source locations
- refresh or open the live Preview separately

### Current boundary

Automatic build/runtime error repair is not implemented yet. If an edit breaks the generated project, the Preview exposes that failure and repair remains manual for now.

There is also no auth, database, cloud persistence, deployment, or multi-tenant sandbox yet. The Web API and generated runtimes are local development surfaces.

## CLI commands

The same core capabilities are available directly from the CLI:

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

## Current capability map

```text
Prompt Intelligence ✅
Design Intent ✅
Generate Project ✅
Run + Preview ✅
Targeted Project Edit ✅
Visual → Source Edit ✅
Automatic Error Repair ⏭️
```
