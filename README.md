# Yakable

Yakable is an AI app builder focused on one simple product loop: describe what you want, generate working software, preview it, and keep refining it through conversation.

## MVP status

PR 1 establishes the product shell:

- React + TypeScript + Vite + Tailwind CSS frontend
- Chat-first build workspace
- Responsive preview surface with desktop, tablet, and mobile modes
- Clear boundaries for the upcoming Agent and Sandbox integrations

The preview is intentionally mocked in PR 1. AI generation, command execution, and sandbox runtime belong to the following MVP pull requests.

## Development

```bash
npm install
npm run dev
```

The local development server runs on `http://localhost:5173`.

## Checks

```bash
npm run typecheck
npm run build
```

## Roadmap

See [PLAN.md](./PLAN.md) for the high-level product plan.
