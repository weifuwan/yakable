# Yakable Capability Packs

Capability Packs are optional UI capabilities installed on top of Yakable Base.

Each pack owns only files under `src/components/ui/**` and declares its npm dependencies in `pack.json`. Installing a pack never edits product pages, product components, theme tokens, or other project-owned code.

```text
Base
  + data-display
  + navigation
  + overlay
  + form
  + feedback
```

A pack directory contains:

```text
<pack-id>/
├── pack.json
└── files/
    └── src/components/ui/...
```

`pack.json` is versioned and declares:

- compatible Base id/version
- runtime dependencies
- development dependencies
- exact files owned by the pack

Installation is deterministic and conservative:

- dependencies are merged only when versions do not conflict
- existing files are kept when they are byte-identical
- a pack refuses to overwrite a different existing UI file
- repeated installation is idempotent
- installed pack ids are recorded in `.yakable/capabilities.json`

Stage 2.2 does not choose packs automatically and does not involve an AI model.
