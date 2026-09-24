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
│   └── project/
├── features/
│   ├── model/
│   ├── project/
│   └── session/
├── service/
│   ├── http/
│   ├── project/
│   └── session/
├── shared/
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
service

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

Project routes use the project id as URL state:

```text
/dashboard
/dashboard/project/:projectId
```

Creating a project returns the id first, then navigation moves immediately to the project page. AI generation is a separate lifecycle step and must not block project creation/navigation.

## features

Features own product capabilities.

Detailed feature constraints: [FEATURE_RULES.md](./src/features/FEATURE_RULES.md).

`project` owns Dashboard project interactions and project-query state. `model` owns model identity and selection UI; its current catalog is local until a real model API exists. `session` owns the Conversation / Session workspace and message interaction.

Add one feature at a time only after its ownership and contract are understood. The current product stage intentionally stops at conversation; Agent execution, planning, generated files, and Preview remain future work.

Feature owns UI state, hooks and components. Backend API contracts and endpoint calls belong to `src/service`.

Within `features/session`, ownership follows Conversation capabilities instead of accumulating in one workspace component:

- `SessionWorkspace` composes Session state, optimistic USER turns, model selection, rendering and capability hooks.
- `useSessionMessageWindow` owns the currently loaded persisted Message window.
- `useSessionViewport` owns follow-latest, scroll position, older/newer paging interaction and return-to-latest behavior.
- `useTurnStream` owns browser-side Streaming / watch / rewatch / polling fallback and active stream stop lifecycle.
- `turn-navigator` owns long-session navigation.
- `useTurnWindowing` owns heavy Turn DOM windowing.

Do not introduce a global Session store only to reduce component line count; state stays at the smallest real owner.

### Session architecture acceptance

The current Session frontend ownership is accepted for V1.

- `SessionWorkspace` remains the composition boundary even if it is not a tiny component; it owns Session-level composition rather than one isolated interaction.
- `useTurnStream` stays as one lifecycle Hook. Watch / rewatch / polling fallback / active request / local Stop share the same AbortController, Turn identity and streaming state, so splitting them now would introduce coordination without a clearer owner.
- `useSessionViewport`, `useSessionMessageWindow`, `useTurnNavigator` and `useTurnWindowing` already have distinct ownership and should not be merged back into Workspace.
- Optimistic USER state, requestId reuse, model selection and Turn render composition stay in Workspace because they coordinate multiple Session capabilities.
- Do not introduce Zustand, Context Provider, command/query Hooks or handler-only Hooks only to reduce file length.

Re-open the boundary when a state owner becomes independently reusable or gains a contract that can be tested without coordinating the rest of Session.

The Project page is conversation-first: user messages render on the right, assistant messages render on the left, and the shared PromptComposer stays fixed at the bottom. The browser never fabricates assistant replies; assistant messages appear only when the backend actually provides them.

The current Project backend persists through a repository port with a Boot-owned in-memory adapter. This is a development persistence boundary, not durable storage; replacing it with a database must not require changing Project command/query services.

## shared

Shared contains infrastructure and UI primitives that have no product-feature owner.

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

Backend requests use one fixed dependency direction:

```text
page / component / hook
        ↓
domain Service
        ↓
HttpUtils
        ↓
Backend API
```

- all backend endpoints live under `src/service/<domain>`.
- components, pages and hooks must not call `fetch` directly.
- `HttpUtils` owns HTTP, `Result<T>`, network errors, JSON parsing and SSE framing.
- domain Service owns endpoint paths, request/response contracts and SSE business events.
- API contract types live with the owning Service, not under feature.
- details are defined in [SERVICE_RULES.md](./SERVICE_RULES.md).

## UI boundary

`shared/ui` is the internal Yak UI layer and owns small, reusable Yakable product primitives.

```text
page / feature / app
        ↓
@/shared/ui (Yak UI)
        ↓
@base-ui/react (headless behavior when needed)
        ↓
DOM
```

Base UI is an implementation dependency, not a product-facing API. Yak UI owns the stable Props and visual contract through Yakable Design Tokens / Tailwind; product code does not import Base UI directly.

Detailed primitive constraints: [UI_RULES.md](./src/shared/ui/UI_RULES.md).

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
├── markdown/
│   ├── Markdown.tsx
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
- Markdown content is rendered only through `shared/ui/markdown`; message features pass content strings and do not own Markdown parsing.
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

See [docs/tooling.md](./docs/tooling.md) for the tooling contract and [TEST_RULES.md](./TEST_RULES.md) for test boundaries.
