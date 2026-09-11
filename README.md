# Yakable

Yakable is being rebuilt one product problem at a time.

> One stage, one problem, one verifiable outcome.

## Stage 1 — Prompt → Code ✅

Stage 1 turns one natural-language product prompt into a complete React + TypeScript + Vite source tree.

```bash
npm install
cp .env.example .env
# add DEEPSEEK_API_KEY to .env
npm run generate -- "Build a clean SaaS landing page"
```

Generated source is written under `generated/<project-id>/`.

DeepSeek defaults to `deepseek-v4-pro`. Stage 1 keeps thinking disabled by default and supports these request controls:

```env
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_TIMEOUT_MS=600000
DEEPSEEK_MAX_TOKENS=16384
DEEPSEEK_THINKING=disabled
```

## Stage 2 — Code → Run 🚧

Stage 2 answers one new question:

> Can Yakable take a generated source tree and actually run it in the browser?

Run any Stage 1 project with:

```bash
npm run run:project -- generated/<project-id>
```

Yakable starts a local Vite runtime and prints a URL such as:

```text
Yakable Stage 2: Code -> Run
Project: my-project

Runtime ready
http://127.0.0.1:5173/
```

Open that URL in your browser. Press `Ctrl+C` to stop the runtime.

### Controlled runtime boundary

Stage 2 deliberately does **not** execute scripts from the generated `package.json` and does not run `npm install` inside generated projects. The runtime uses Yakable's own Vite installation plus a small shared dependency set (`react`, `react-dom`, `lucide-react`). Generated projects are only allowed to run from the local `generated/` directory.

This is a local MVP runtime, **not** a production sandbox or multi-tenant security boundary.

### Explicitly out of scope

Stage 2 does not add:

- Agent tool calling
- follow-up prompt editing
- automatic build/runtime repair
- retries driven by AI
- project versions
- database/auth/backend
- deployment
- an embedded Yakable web Preview workspace

If the generated code has an import or runtime error, Vite/browser output should expose the real error. Automatic repair belongs to Stage 4.

## Checks

```bash
npm run typecheck
npm test
```

## Current flow

```text
Prompt
  ↓
DeepSeek
  ↓
Code
  ↓
Yakable local Vite runtime
  ↓
Browser URL
```
