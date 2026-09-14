# Yakable Base

Yakable Base is a neutral frontend foundation, not a design template. It gives every project the same predictable React + Vite + Tailwind environment while leaving product structure and visual composition open.

## Run standalone

```bash
npm install
npm run dev
```

## Ownership

`yakable.template.json` is the source of truth for the boundary:

- **Yakable-owned:** package/tooling, the runtime entry, Base stylesheet, utilities, and minimal `components/ui` primitives.
- **Project-owned:** page title/assets, theme tokens, `App`, routes, pages, product components, features, and data.

The split between `src/styles.css` and `src/styles/theme.css` is intentional: Yakable owns the Tailwind/reset contract, while each project owns its visual tokens.

Stage 2.1 intentionally contains no capability packs, design patterns, template retrieval, or AI selection logic.
