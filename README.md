# Yakable

Yakable is being rebuilt one product problem at a time.

> One capability, one problem, one verifiable outcome.

## Web product flow

The Lovable-inspired dashboard is wired to Yakable's build-intent routing, prompt intelligence, project generation, runtime, preview, editing, and local SQLite persistence capabilities.

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
Build Intent Gate
  ├── CHAT → respond without creating a project
  ├── CLARIFY → ask for a clearer build request
  └── CREATE
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

- route new dashboard input through CREATE / CHAT / CLARIFY before project generation
- prevent greetings and ambiguous Hello World-style inputs from creating projects
- create a new project from a clear dashboard build request
- analyze CREATE requests through Intent Parser, Semantic Expander, Taste Translator, and Design Intent IR
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

### Build Intent Gate

The dashboard no longer treats every non-empty input as a project request. The gate runs before Intent Parser and returns one of three routes:

```text
CREATE   clear request to build a frontend project
CHAT     greeting, casual chat, or a non-build question
CLARIFY  plausible project idea, but creation intent is ambiguous
```

Examples:

```text
Hello                         → CHAT
React 是什么？                 → CHAT
Hello World                   → CLARIFY
Hello word                    → CLARIFY
Todo App                      → CLARIFY
做一个 Hello World 页面        → CREATE
帮我做一个 Todo App            → CREATE
```

`Hello`, `你好`, `Hello World`, and the common `Hello word` typo also have local high-confidence guardrails so those obvious cases do not spend a model call or accidentally reach generation.

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

## Yakable Templates — Stage 2

### Stage 2.1: Base Template

`templates/base/` is a neutral React + Vite + Tailwind foundation that can be copied without invoking a model. It establishes the environment before Yakable adds optional capabilities or product code.

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

The Base contract keeps infrastructure separate from product code:

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

### Stage 2.2: Capability Packs

`templates/packs/` contains optional capabilities that can be installed explicitly on top of Base. A pack owns only `src/components/ui/**`, declares the exact files it contributes, and declares the npm dependencies those files require.

List the current catalog:

```bash
npm run list:packs
```

Current packs:

```text
data-display  Badge + Card + Table
navigation    Breadcrumb + Tabs
overlay       Dialog + Popover + Dropdown Menu + Tooltip
form          Form helpers + Select + Checkbox + Switch + Textarea
feedback      Alert + Progress + Skeleton + Sonner toast
chart         Responsive ChartContainer + Recharts
date          Calendar + React Day Picker + date-fns
command       Command palette primitives + cmdk
```

Install one or more packs into an existing Base project:

```bash
npm run add:pack -- base-demo data-display navigation overlay
npm run add:pack -- base-demo chart date command
cd generated/base-demo
npm install
```

Installation is intentionally conservative:

- selected pack files are copied; unrelated files are untouched
- package dependencies are merged only when versions do not conflict
- an existing different UI file is never overwritten
- repeated pack installation is idempotent
- installed pack ids are recorded in `.yakable/capabilities.json`
- product pages, theme, features, and product components remain project-owned

Stage 2.2 still has **no AI pack selection, no design patterns, no Hero/Pricing/Dashboard knowledge base, and no automatic dependency installation**. It only makes optional frontend capabilities deterministic and composable.

## CLI commands

The core capabilities are available directly from the CLI:

```bash
npm run create:base -- base-demo
npm run list:packs
npm run add:pack -- base-demo data-display navigation
npm run add:pack -- base-demo chart date command
npm run generate -- "Build a clean SaaS landing page"
npm run run:project -- generated/<project-id>
npm run edit -- generated/<project-id> "把 Hero 主色改成蓝色"
```

`npm run generate` also respects Build Intent Gate, so a CHAT or CLARIFY input exits without writing a project.

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
Build Intent Gate ✅
Prompt Intelligence ✅
Design Intent ✅
Generate Project ✅
Run + Preview ✅
Targeted Project Edit ✅
Persistent Edit Context ✅
Persistent Conversation (SQLite) ✅
Visual → Source Edit ✅
Yakable Base Template ✅
Capability Packs ✅
Automatic Error Repair ⏭️
```
