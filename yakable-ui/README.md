# Yakable UI

Yakable's browser application.

## Development

```bash
npm install
npm run dev
```

The Vite development server proxies `/api` to the Java backend at `http://127.0.0.1:8080`.

## Quality checks

```bash
npm run check
```

Use `npm run lint:fix` for safe lint fixes, `npm run format` to format code, and `npm run test:watch` while developing tests.

See [docs/tooling.md](./docs/tooling.md) for the executable frontend tooling contract and [docs/testing.md](./docs/testing.md) for the testing contract.

## Source architecture

```text
src/
├── app/
├── assets/
├── pages/
├── features/
└── shared/
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for ownership and dependency rules.

Browser-native behavior stays in this module, including Preview DOM interaction and visual selection.

Backend domain logic, model integration, project orchestration, persistence, and Harness runtime belong in the Java modules.
