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

DeepSeek defaults to `deepseek-v4-pro`; override `DEEPSEEK_MODEL` or `DEEPSEEK_BASE_URL` in `.env` when needed.

## Checks

```bash
npm run typecheck
npm test
```

## Stage 1 success criteria

Stage 1 is successful when a prompt produces a validated source tree containing at least `package.json`, `index.html`, `src/main.tsx`, and `src/App.tsx`, with no code execution required.
