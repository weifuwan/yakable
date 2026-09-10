# Yakable

Yakable is an AI app builder in progress. The MVP is being built as a sequence of small, reviewable product slices.

## MVP status

PR 1 established the core product shell:

- React + TypeScript + Vite + Tailwind CSS
- Chat-first build workspace
- Desktop / tablet / mobile preview modes
- Static preview boundary for the future Sandbox runtime

PR 2 adds the first real AI boundary:

- Server-side AI Provider abstraction
- Anthropic Messages API provider with `claude-sonnet-5` as the default model
- Offline mock provider when no API key is configured
- Bounded Agent loop with tool calls and tool results
- Foundation tools for workspace inspection and implementation planning
- Frontend Chat wired to `/api/agent/run`

File writes, command execution and a real generated-project runtime are intentionally deferred to the next PRs.

## Local development

Install dependencies:

```bash
npm install
```

Copy the environment template if you want to use Claude:

```bash
cp .env.example .env
```

Set `ANTHROPIC_API_KEY` in `.env`. If it is omitted, the API automatically uses a deterministic mock provider so the Agent loop can still be exercised locally.

Run the API in one terminal:

```bash
npm run dev:api
```

Run the web app in another terminal:

```bash
npm run dev:web
```

Open `http://localhost:5173`.

## Checks

```bash
npm run typecheck
npm run build
```

## Security boundary

Model credentials live only in the Node API process. Never put provider secrets in `VITE_*` variables because Vite exposes those variables to browser code.

See [PLAN.md](./PLAN.md) for the broader product roadmap.
