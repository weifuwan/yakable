# Shared UI

`shared/ui` contains reusable Yakable product UI primitives.

The initial primitive set is intentionally small:

- `Button`
- `IconButton`
- `Input`
- `Icon`

## Rules

- primitives are feature-agnostic and must not know Project, Workspace, Editor, or Agent concepts
- product features import primitives from `@/shared/ui`
- prefer native HTML semantics and preserve keyboard/focus behavior
- `Button` and `IconButton` default to `type="button"` to avoid accidental form submission
- every `IconButton` requires an accessible `aria-label`
- `Icon` is decorative by default; provide `label` only when the icon itself carries meaning
- feature-specific composites stay with the owning feature instead of being promoted into `shared/ui` early
- add a new primitive only after a real reusable boundary appears

This is the Yakable product UI layer. It is separate from the Frontend Harness component library exposed to generated projects.
