# Frontend Tooling

Yakable UI keeps the frontend quality gate intentionally small and executable.

## Required checks

Run from `yakable-ui/`:

```bash
npm run check
```

`check` runs four independent gates:

```text
typecheck
   ↓
lint
   ↓
format:check
   ↓
test
```

A change is not considered locally clean until all three pass.

## Commands

```bash
npm run typecheck
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm test
npm run test:watch
npm run check
```

## Lint

Oxlint owns static lint rules.

Current scope:

- TypeScript / TSX under `src/`
- `vite.config.ts`
- React Hooks rules
- JSX accessibility rules
- TypeScript, Unicorn, Oxc, and ESLint correctness rules

Warnings are treated as failures. Do not add broad disable blocks to make a check green; fix the owner problem first. A narrow disable is acceptable only when the code documents why the rule does not apply.

## Format

Oxfmt owns code formatting.

Current format scope is intentionally code-only:

- `src/`
- `vite.config.ts`

CSS and prose documentation are not part of the formatter gate yet. Expand the scope only when the repository has a clear formatting contract for those file types.

## Type checking

TypeScript remains the source of truth for static type correctness:

```bash
tsc --noEmit
```

Linting does not replace type checking, and type checking does not replace linting.

## Dependency policy

Tool versions are pinned exactly in `devDependencies` so a normal install cannot silently change lint or format behavior.

Do not add another linter or formatter without a concrete gap in the current toolchain.


## Test

Vitest owns frontend unit and component tests. The default DOM environment is happy-dom and React components use React Testing Library.

See [testing.md](./testing.md) for test boundaries and conventions.
