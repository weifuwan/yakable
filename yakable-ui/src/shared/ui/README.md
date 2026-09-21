# Shared UI

`shared/ui` contains reusable Yakable product UI primitives.

The initial primitive set is intentionally small:

- `Button`
- `IconButton`
- `Input`
- `Icon`
- `Markdown`
- `PromptComposer`
- `Select`

## Rules

- primitives are feature-agnostic and must not know Project, Workspace, Editor, or Agent concepts
- product features import primitives from `@/shared/ui`
- prefer native HTML semantics and preserve keyboard/focus behavior
- `Button` and `IconButton` default to `type="button"` to avoid accidental form submission
- `Button` visual intent must be expressed through its `variant`, `size`, and `shape` contract; feature code must not redefine button color, background, border, radius, or control height through `className`
- `Button className` is an escape hatch for layout concerns such as width, positioning, or surrounding spacing; use `asChild` when a link or another element needs Button presentation while keeping its native semantics
- every `IconButton` requires an accessible `aria-label`
- `Icon` is decorative by default; provide `label` only when the icon itself carries meaning
- feature-specific composites stay with the owning feature instead of being promoted into `shared/ui` early
- `PromptComposer` owns reusable input mechanics such as autosizing, IME safety, Enter/Shift+Enter behavior, and submission state; its submit/stop control must use the shared `Button` contract instead of defining another button visual system
- `Markdown` is the single renderer for message Markdown; features must not parse or render Markdown themselves
- `Select` owns trigger, floating menu, radio selection, keyboard navigation, focus restoration, and viewport-aware positioning; features provide option data and optional footer content
- `Select` trigger surface is owned by its layered chassis; feature code must not recreate or override its fill, rim, shadow, highlight, pressed, or engaged effects
- feature-specific shortcuts, mode semantics, and labels such as Build or Plan stay outside `Select`
- add a new primitive only after a real reusable boundary appears

This is the Yakable product UI layer. It is separate from the Frontend Harness component library exposed to generated projects.
