# Yakable

Yakable is built as a small monorepo with clear application and domain boundaries.

## Structure

```text
apps/
  web/        Yakable frontend
  server/     Yakable backend

packages/
  project/    Project domain
  workspace/  Workspace domain
  agent/      Agent domain
  harness/    Frontend Harness
  runtime/    Runtime domain

templates/
  react-vite/ Default project template
```

## Run

```bash
npm install
npm run dev
```

The frontend runs through Vite and proxies `/api` to the Yakable server.
