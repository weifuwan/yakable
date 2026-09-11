# Yakable

Yakable is being rebuilt one product problem at a time, following the same kind of staged progression that made early prompt-to-code tools useful before they grew into full AI app builders.

## Stage 1 — Prompt → Code

Stage 1 answers exactly one question:

> Can one natural-language product prompt reliably become a complete frontend source tree?

The current implementation is intentionally a CLI instead of a web workspace. It sends one prompt to DeepSeek, requests a complete React + TypeScript + Vite project as structured JSON, validates the returned file tree, and writes the source under `generated/`.

```text
Prompt
  ↓
DeepSeek
  ↓
Structured project files
  ↓
Validation
  ↓
generated/<project-id>/
```

### In scope

- one product prompt
- one DeepSeek request
- complete text source files
- strict JSON response parsing
- safe relative-path validation
- file-count and output-size limits
- local source-tree output

### Explicitly out of scope

- Agent tool calling or an Agent loop
- reading or editing an existing generated project
- Preview / Vite runtime execution
- build verification or automatic repair
- database, auth, deployment, GitHub sync, versions, or visual editing

Those belong to later stages. Stage 1 should remain understandable without knowing Agent concepts.

## Run locally

Requirements: Node.js 20.6+ and a DeepSeek API key.

```bash
npm install
cp .env.example .env
# add DEEPSEEK_API_KEY to .env
npm run generate -- "Build a clean SaaS landing page for a team analytics product"
```

The command prints the generated directory. Yakable does **not** execute the generated project in Stage 1.

DeepSeek defaults to `deepseek-v4-pro`. Stage 1 deliberately disables thinking by default so a full source-tree generation does not spend unnecessary time in high-effort reasoning.

Available request controls:

```env
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_TIMEOUT_MS=600000
DEEPSEEK_MAX_TOKENS=16384
DEEPSEEK_THINKING=disabled
```

`DEEPSEEK_TIMEOUT_MS=600000` gives one generation up to 10 minutes. If a request still times out, retry first; only increase the timeout when the model or network consistently needs more time.

### Timeout troubleshooting

If you see a timeout error, verify that `DEEPSEEK_THINKING=disabled` is still set for Stage 1. The CLI now reports a clear timeout message instead of the raw Node.js abort error.

You can temporarily raise the timeout, for example:

```env
DEEPSEEK_TIMEOUT_MS=900000
```

Stage 1 remains a single request: changing this value does not add retries, Agent behavior, code execution, or automatic repair.

## Checks

```bash
npm run typecheck
npm test
```

## Stage 1 success criteria

Stage 1 is successful when a prompt produces a validated source tree containing at least `package.json`, `index.html`, `src/main.tsx`, and `src/App.tsx`, with no code execution required.
