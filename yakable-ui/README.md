# Yakable UI

Yakable's browser application.

## Development

```bash
npm install
npm run dev
```

The Vite development server proxies `/api` to the Java backend at `http://127.0.0.1:8080`.

## Source architecture

```text
src/
├── app/
├── pages/
├── features/
└── shared/
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for ownership and dependency rules.

Browser-native behavior stays in this module, including Preview DOM interaction and visual selection.

Backend domain logic, model integration, project orchestration, persistence, and Harness runtime belong in the Java modules.
