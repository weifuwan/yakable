# Yakable

Yakable is being rebuilt one product problem at a time.

> One capability, one problem, one verifiable outcome.

## Web product flow

The Lovable-inspired dashboard is wired to Yakable's prompt intelligence, project generation, runtime, preview, editing, and local SQLite persistence capabilities.

Yakable now requires Node.js 22.13 or newer because it uses Node's built-in SQLite module without an experimental runtime flag.

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
Persist conversation + edit context in SQLite
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
- restore the project's persisted conversation after closing or reloading the browser
- send follow-up edit prompts against the existing project
- keep the original product request, Design Intent, and recent successful edits as persisted context for later edits
- persist Visual Edit source targets with the user message that used them
- select Preview elements and target edits back to mapped JSX source locations
- refresh or open the live Preview separately

### Local persistence

Conversation and edit history are stored in SQLite at `data/yakable.db` by default. Generated source code remains under `generated/<project-id>/`.

```text
SQLite                       generated/<project-id>/
├── project session          ├── src/
├── conversation history    ├── public/
└── Visual Edit targets      └── project source files
```

Set `YAKABLE_DB_PATH` to override the database location. SQLite is the only conversation/session store.

Automatic build/runtime error repair is not implemented yet. If an edit breaks the generated project, the Preview exposes that failure and repair remains manual for now.

There is still no auth, cloud persistence, deployment, or multi-tenant sandbox yet. The Web API, SQLite database, and generated runtimes are local development surfaces.

## Yakable Base Template — Stage 2.1

`templates/base/` is a neutral React + Vite + Tailwind foundation that can be copied without invoking a model. It establishes the environment before Yakable adds optional capability packs or AI-driven product code.

Create one directly:

```bash
npm run create:base -- base-demo
npm run run:project -- generated/base-demo
```

The copied project is also standalone:

```bash
cd generated/base-demo
npm install
npm run dev
```

The template contract lives in `yakable.template.json`:

```text
Yakable-owned                    Project-owned
├── package / Vite / TS config   ├── index.html + public/**
├── runtime entry                ├── src/styles/theme.css
├── Tailwind/reset contract      ├── src/App.tsx + src/routes.ts
├── utilities                    ├── src/pages/**
└── src/components/ui/**         ├── src/components/product/**
                                 ├── src/features/**
                                 └── src/data/**
```

Stage 2.1 intentionally does **not** add capability packs, design patterns, retrieval, template selection, or AI integration.

## CLI commands

The core capabilities are available directly from the CLI:

```bash
npm run create:base -- base-demo
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
Persistent Edit Context ✅
Persistent Conversation (SQLite) ✅
Visual → Source Edit ✅
Yakable Base Template ✅
Automatic Error Repair ⏭️
```
