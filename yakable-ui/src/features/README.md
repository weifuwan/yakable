# Features

Features own Yakable product capabilities.

Implemented feature boundaries include:

- `project`: project query and Dashboard project interaction ownership
- `model`: model identity and selector ownership; the first catalog is local until a backend model endpoint exists
- `conversation`: project message persistence and chat workspace ownership

Add one feature at a time only after its ownership, contract, API boundary, state model, and UI responsibility are understood.

Future capabilities such as Agent execution, planning, generated files, editor, and Preview should be added only after the conversation contract is stable.

Do not pre-create feature modules only to reserve names. Feature-specific types, APIs, state, hooks, and components stay with their owning feature.
