# Yakable UI Architecture v0

Yakable UI is organized by ownership instead of by file type.

```text
src/
├── app/
│   ├── App.tsx
│   ├── providers/
│   ├── router/
│   ├── layout/
│   └── styles/
├── pages/
│   ├── dashboard/
│   └── workspace/
├── features/
│   ├── agent-run/
│   ├── editor/
│   ├── preview/
│   ├── project/
│   └── workspace/
├── shared/
│   ├── api/
│   ├── lib/
│   └── ui/
└── main.tsx
```

## Dependency direction

```text
app
 ↓
pages
 ↓
features
 ↓
shared
```

Dependencies should point downward. Shared code must not import product features.

## app

Owns application composition, routing, global layout, and global styles.

- `App.tsx` is the composition entry and should stay thin.
- `app/providers` owns application-wide framework providers and root runtime wrappers.
- `app/router` owns browser routing and route registration.
- `main.tsx` only mounts the React application; app-wide wrappers belong in `app/providers`.
- Feature-specific providers and domain state stay with their owning feature.
- Pages and features must not implement their own `window.history` / `popstate` routing.

It should not become a dumping ground for domain logic.

## pages

Pages compose features into complete product surfaces.

A page should answer "what is shown here?" rather than own API clients, protocol parsing, or reusable domain behavior.

## features

Features own product capabilities.

The directory is intentionally empty at this baseline. Old demo feature implementations were removed instead of being treated as production architecture.

Add one feature at a time only after its ownership and contract are understood. Likely future areas include Project, Workspace, Editor, Preview, and Agent Run.

Feature-specific types, APIs, state, hooks, and components should stay with their feature once that feature exists.

## shared

Shared contains infrastructure and UI primitives that have no product-feature owner.

- `shared/api`: generic HTTP / stream transport only.
- `shared/lib`: framework-independent or browser-generic helpers.
- `shared/ui`: reusable Yakable product UI primitives.

Shared must not know Project, Editor, Agent Run, or Workspace business rules.

## UI components

A reusable primitive should gradually become its own component unit under `shared/ui`, following the engineering discipline used by mature component libraries:

```text
shared/ui/button/
├── Button.tsx
├── Button.test.tsx
└── index.ts
```

Do not split components mechanically before they have a real reusable boundary.

## Harness boundary

Yakable product UI components are not the Frontend Harness Component Library.

```text
yakable-ui/src/shared/ui
= components used to build the Yakable product

Frontend Harness Component Library
= controlled components and metadata exposed to generated projects
```

The two may share design ideas, but they have different owners and must not be coupled implicitly.

## Current non-goals

This architecture refactor does not yet introduce:

- TanStack Query
- Zustand
- a pnpm workspace / Turborepo
- a separately published UI package

Those should be introduced only when a concrete product or engineering problem requires them.
