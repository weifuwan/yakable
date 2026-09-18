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

- `shared/api`: generic HTTP, error, cancellation, and stream transport.
- `shared/lib`: framework-independent or browser-generic helpers.
- `shared/ui`: reusable Yakable product UI primitives.

Shared must not know Project, Editor, Agent Run, or Workspace business rules.

## API boundary

`shared/api` is the only owner of browser transport mechanics.

```text
page / component
      ↓
feature API
      ↓
shared/api
      ↓
browser fetch
```

- pages and components do not call `fetch` directly.
- feature API modules own endpoint paths, methods, domain request/response types, and domain mapping.
- feature API modules reuse `shared/api` for HTTP, JSON, errors, cancellation, and stream decoding.
- `shared/api` must not import feature types or contain feature-specific protocol messages.
- a new HTTP library may replace the implementation later without changing feature ownership.

## UI boundary

`shared/ui` owns small, reusable Yakable product primitives.

```text
shared/ui/
├── button/
│   ├── Button.tsx
│   └── index.ts
├── icon-button/
│   ├── IconButton.tsx
│   └── index.ts
├── icon/
│   ├── Icon.tsx
│   └── index.ts
├── input/
│   ├── Input.tsx
│   └── index.ts
├── cx.ts
└── index.ts
```

Current primitive rules:

- import product primitives from `@/shared/ui`; the root barrel is the public contract.
- primitives use native HTML semantics and expose refs to their underlying elements.
- interactive primitives preserve visible keyboard focus and native disabled behavior.
- `IconButton` requires an accessible name.
- feature-specific composites stay inside the owning feature.
- do not promote a component into `shared/ui` merely because it is visually reusable once.
- colocate primitive behavior tests with their owning component when a stable contract is worth protecting.

Do not grow `shared/ui` into a second product-feature layer.

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

## Engineering checks

Frontend architecture rules are backed by executable checks rather than review convention alone.

- `npm run typecheck` owns TypeScript correctness.
- `npm run lint` owns static code rules.
- `npm run format:check` owns code formatting.
- `npm test` owns frontend unit and component behavior.
- `npm run check` is the local aggregate quality gate.

See [docs/tooling.md](./docs/tooling.md) for the tooling contract and [docs/testing.md](./docs/testing.md) for test boundaries.
