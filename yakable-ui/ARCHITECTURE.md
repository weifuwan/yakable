# Yakable UI Architecture v0

Yakable UI is organized by ownership instead of by file type.

```text
src/
├── app/
│   ├── App.tsx
│   ├── providers/
│   ├── router/
│   ├── layout/
│   ├── navigation/
│   │   └── sidebar/
│   └── styles/
├── assets/
├── pages/
│   ├── dashboard/
│   └── workspace/
├── features/
│   ├── agent-run/
│   ├── editor/
│   ├── preview/
│   ├── model/
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
- `app/layout` owns route-level application composition such as the persistent sidebar and page outlet.
- `app/navigation` owns application-level static navigation such as Dashboard.
- `app/styles` owns application-wide CSS and app-global style resources such as font binaries.
- global CSS is limited to reset, typography, theme, and viewport rules; page or feature visuals stay with their owner.
- do not target page structure from global CSS with positional selectors such as `main > section:first-of-type`; use an explicit component class when a visual effect has a real owner.
- `main.tsx` only mounts the React application; app-wide wrappers belong in `app/providers`.
- Feature-specific providers and domain state stay with their owning feature.
- Pages and features must not implement their own `window.history` / `popstate` routing.

It should not become a dumping ground for domain logic.

## pages

Pages compose features into complete product surfaces.

A page should answer "what is shown here?" rather than own API clients, protocol parsing, or reusable domain behavior.

## features

Features own product capabilities.

`project` owns Dashboard project interactions and project-query state. `model` owns model identity and selection UI; its current catalog is local until a real model API exists.

Add one feature at a time only after its ownership and contract are understood. Likely future areas include Workspace, Editor, Preview, and Agent Run.

Feature-specific types, APIs, state, hooks, and components stay with their owning feature.

## shared

Shared contains infrastructure and UI primitives that have no product-feature owner.

- `shared/api`: small reusable API-related primitives; transport is added only when repetition justifies it.
- `shared/lib`: framework-independent or browser-generic helpers.
- `shared/ui`: reusable Yakable product UI primitives.

Shared must not know Project, Model, Editor, Agent Run, or Workspace business rules.

## Navigation boundary

Navigation follows ownership instead of living in one global menu registry.

- application-level static entries live in `app/navigation`.
- dynamic project entries such as Recents stay in the `project` feature because their data comes from the Project API.
- feature-private navigation belongs to the owning feature when that feature needs it.
- URL state determines the active item; do not duplicate the selected route in global state.
- only shipped capabilities appear in navigation. Do not pre-create placeholder entries for Search, Library, Templates, Settings, or other future features.

The current sidebar intentionally contains only Dashboard and Recent Projects.

## Asset boundary

Static resources follow the same ownership rule as code.

- app-global style resources live with `app/styles`; global font binaries are colocated under `app/styles/fonts`.
- resources shared across product areas and imported through Vite live in `src/assets`.
- feature-private images, SVGs, fonts, and other resources stay inside the owning feature, for example `features/project/assets`.
- use `public/` only when a resource needs a stable browser URL and should not be imported through the module graph.
- do not create top-level `font/`, `image/`, `css/`, or similar file-type buckets.

Ownership decides where a resource lives; its file extension does not.

## API boundary

Business requests belong to the owning feature.

```text
page / component
      ↓
feature/api
      ↓
browser API
```

- pages and presentation components do not own business requests.
- feature API modules own endpoint paths, methods, domain request/response types, and domain mapping.
- feature API modules may use native `fetch` directly while transport behavior remains simple.
- `shared/api` contains only API-related primitives that already have a proven reusable boundary.
- do not create a shared HTTP client or stream layer until repeated code creates a concrete ownership problem.
- `shared/api` must never import feature types or contain feature-specific protocol messages.

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
├── prompt-composer/
│   ├── PromptComposer.tsx
│   ├── PromptComposerActions.tsx
│   ├── useComposerInput.ts
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
- shared UI owns interaction mechanics while features own product meaning; for example PromptComposer owns text entry and keyboard behavior, while Project owns what a submitted prompt creates.
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
