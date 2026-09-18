# Agent

Agent owns the model interaction boundary.

The first Yakable agent is intentionally narrow:

- input: user prompt + current `src/App.tsx`
- output: complete replacement for `src/App.tsx`
- allowed files: `src/App.tsx` only
- no dependency changes
- no package.json changes

This is deliberate: deterministic system constraints stay outside the model.
