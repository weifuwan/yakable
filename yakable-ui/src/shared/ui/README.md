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
- `PromptComposer` surface is owned by its chassis (shadow, fill, highlight, rim, focus glow, and halo); feature code must not rebuild the composer shell with ad-hoc border or shadow classes
- animated PromptComposer suggestions are visual placeholders only; they must never write into the textarea value or submission payload, and features opt in through `placeholderPrefix` / `placeholderSuggestions`
- `Markdown` is the single renderer for message Markdown; features must not parse or render Markdown themselves
- `Select` owns trigger, floating menu, radio selection, keyboard navigation, focus restoration, and viewport-aware positioning; features provide option data and optional footer content
- `Select` trigger appearance must be chosen through `surface`: use `chassis` for the layered bordered control and `borderless` for a transparent control with lightweight interaction feedback; feature code must not recreate or override these surface effects through `className`
- feature-specific shortcuts, mode semantics, and labels such as Build or Plan stay outside `Select`
- add a new primitive only after a real reusable boundary appears

This is the Yakable product UI layer. It is separate from the Frontend Harness component library exposed to generated projects.
