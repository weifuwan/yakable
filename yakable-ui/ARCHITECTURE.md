# Yakable UI Architecture v0

Yakable UI is organized by ownership instead of by file type.

```text
src/
├── app/
│   ├── App.tsx
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

Owns application composition, global layout, global styles, and route-level orchestration.

It should not become a dumping ground for domain logic.

## pages

Pages compose features into complete product surfaces.

A page should answer "what is shown here?" rather than own API clients, protocol parsing, or reusable domain behavior.

## features

Features own product capabilities.

Current owners:

- `project`: project contracts, project CRUD/runtime API, project creation, project cards and composer.
- `editor`: workspace editor behavior and edit execution.
- `preview`: browser-only preview observation and visual-selection behavior.
- `agent-run`: agent protocol, progress events, run details, cancellation UI.
- `workspace`: project-building workspace state and UI.

Feature-specific types, APIs and components should stay with their feature.

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

- React Router
- TanStack Query
- Zustand
- a pnpm workspace / Turborepo
- a separately published UI package

Those should be introduced only when a concrete product or engineering problem requires them.
