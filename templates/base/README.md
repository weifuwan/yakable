# Yakable Base

Yakable Base is a neutral frontend foundation, not a design template. It gives every project the same predictable React + Vite + Tailwind environment while leaving product structure and visual composition open.

## Run standalone

```bash
npm install
npm run dev
```

## Ownership

`yakable.template.json` is the source of truth for the boundary:

- **Yakable-owned:** package/tooling, the runtime entry, Base stylesheet, utilities, and `components/ui` primitives supplied by Base or Capability Packs.
- **Project-owned:** page title/assets, theme tokens, `App`, routes, pages, product components, features, and data.

The split between `src/styles.css` and `src/styles/theme.css` is intentional: Yakable owns the Tailwind/reset contract, while each project owns its visual tokens.

Optional Stage 2.2 Capability Packs can add more `src/components/ui/**` files and merge their declared dependencies without touching project-owned code. Pack selection remains explicit; the Base itself contains no AI selection logic or design patterns.
