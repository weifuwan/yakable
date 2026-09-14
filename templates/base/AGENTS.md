# Yakable Base ownership

This project starts from Yakable Base. Keep the runtime foundation stable and make product work in the project-owned area.

## Yakable-owned foundation

Avoid changing these unless the task explicitly changes project infrastructure:

- `package.json`, `vite.config.ts`, `tsconfig.json`, `components.json`
- `src/main.tsx`, `src/styles.css`, `src/lib/utils.ts`
- `src/components/ui/**`

## Project-owned application code

Product-specific work belongs here:

- `index.html`, `public/**`
- `src/styles/theme.css`
- `src/App.tsx`, `src/routes.ts`
- `src/pages/**`
- `src/components/product/**`
- `src/features/**`
- `src/data/**`

Prefer composing the provided UI primitives instead of duplicating them inside product code. Change theme tokens in `src/styles/theme.css` rather than rewriting the Base stylesheet.
