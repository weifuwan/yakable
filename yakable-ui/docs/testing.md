# Frontend Testing

Yakable UI uses Vitest for frontend tests and happy-dom for the default DOM environment.

The test system exists to protect stable product and infrastructure behavior. It is not a file-coverage exercise.

## Commands

Run from `yakable-ui/`:

```bash
npm test
npm run test:watch
```

`npm run check` also runs the complete test suite after type checking, linting, and formatting checks.

## Test boundary

Use the smallest boundary that proves the behavior owner:

- pure helpers: unit test inputs and outputs directly
- UI primitives and feature components: test user-visible DOM behavior
- feature state and data flow: test through the owning public API or component
- browser-native behavior that happy-dom cannot faithfully prove belongs to a future browser/E2E test layer

## Conventions

- colocate tests with their owner using `*.test.ts` or `*.test.tsx`
- prefer semantic DOM queries such as `getByRole`
- assert behavior rather than implementation details
- do not test Tailwind class strings as the product contract
- do not add tests only to increase a coverage percentage
- bug fixes should add a regression test when the failure can be reproduced through a stable boundary
- mock external boundaries, not the code that owns the behavior under test

## Current baseline

The suite grows only with real feature contracts and regressions. It currently protects:

- `shared/ui/cx.test.ts`: pure utility behavior
- `shared/ui/button/Button.test.tsx`: a real React primitive contract
- `shared/ui/prompt-composer/PromptComposer.test.tsx`: reusable composer keyboard, IME, submit, and clear behavior
- `features/model/components/ModelSelector.test.tsx`: model selector open/select behavior
- `features/conversation/components/ConversationWorkspace.test.tsx`: initial messages, assistant/user roles, send persistence, and composer clear behavior
- `features/project/components/CreateProjectComposer.test.tsx`: Dashboard composer submit, selected-model payload, and project-route navigation
- `features/project/components/ProjectList.test.tsx`: the first feature data-flow contract from API to visible Dashboard state
- `features/project/components/RecentProjects.test.tsx`: recent-project ordering, limit, and URL-driven active state

## Not included yet

- coverage thresholds
- browser mode
- Playwright / E2E
- visual regression
- Storybook tests
- network mocking framework

Add those only when the product has a concrete testing need that unit/component tests cannot cover.
