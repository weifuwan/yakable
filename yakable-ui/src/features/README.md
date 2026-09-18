# Features

Features own Yakable product capabilities.

Implemented feature boundaries include:

- `project`: project query and Dashboard project interaction ownership
- `model`: model identity and selector ownership; the first catalog is local until a backend model endpoint exists

Add one feature at a time only after its ownership, contract, API boundary, state model, and UI responsibility are understood.

Likely future areas include:

- workspace
- editor
- preview
- agent-run

Do not pre-create feature modules only to reserve names. Feature-specific types, APIs, state, hooks, and components stay with their owning feature.
