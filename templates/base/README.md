# Yakable Base

Yakable Base is a neutral frontend foundation, not a design template. It gives every project the same predictable React + Vite + Tailwind environment while leaving product structure and visual composition open.

## Run standalone

```bash
npm install
npm run dev
```

## Ownership

`yakable.template.json` is the source of truth for the boundary:

- **Yakable-owned:** runtime/config, global styles, utilities, public assets, and minimal `components/ui` primitives.
- **Project-owned:** `App`, routes, pages, product components, features, and data.

Stage 2.1 intentionally contains no capability packs, design patterns, template retrieval, or AI selection logic.
