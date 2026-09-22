# Yakable Agent Context Router

Scope:
- Whole repository

Purpose:
- Route an AI task to the minimum required contracts and code rules
- Define execution boundaries
- Do not duplicate detailed rules here

## Backend Context

Any Java change starts with:

```text
JAVA_RULES.md
```

Load `BACKEND_TEST_RULES.md` when changing observable behavior, API contracts, persistence semantics, runtime behavior or regression tests.

Then load only the rules touched by the task:

```text
yakable-boot/**/controller/**
→ yakable-boot/CONTROLLER_RULES.md

yakable-service/**
→ yakable-service/SERVICE_RULES.md

yakable-core/**
→ yakable-core/CORE_RULES.md

yakable-core/**/llm/**
→ yakable-core/src/main/java/io/yakable/core/llm/LLM_DESIGN.md

yakable-common/**
→ yakable-common/COMMON_RULES.md

yakable-dao/**/entity/**
→ yakable-dao/ENTITY_RULES.md

yakable-dao/**/repository/**
yakable-dao/**/mapper/**
→ yakable-dao/REPOSITORY_RULES.md

yakable-dao/src/main/resources/db/migration/**
→ yakable-dao/FLYWAY_RULES.md

yakable-plugins/yakable-plugin-model/**
→ yakable-plugins/yakable-plugin-model/PLUGIN.md
```

## Frontend Context

Frontend rules are still routed through the current frontend documents until the Frontend Code Rules migration is complete:

```text
yakable-ui/**
→ yakable-ui/ARCHITECTURE.md

yakable-ui/src/service/**
→ yakable-ui/SERVICE_README.md
```

## Capability Context

For product behavior, load:

```text
Task
→ docs/README.md
→ Domain README
→ Target Capability
→ Shared Rules / Scenarios
→ Target Code / Tests
→ Nearest Code Rules
```

Do not load every Related capability or every rule file by default.

## Execution Rules

Must:
- Read current code and direct dependencies before changing structure.
- Reuse existing utilities, base capabilities and naming.
- Solve only the current task.
- Prefer modifying existing code over adding layers.
- Load more context only when the current evidence requires it.
- Validate the smallest meaningful behavior after the change.
- State clearly when verification was not executed.

Must Not:
- Expand scope as a side effect.
- Add compatibility code without a real compatibility requirement.
- Add Manager / Coordinator / Handler / Assembler layers for architectural symmetry.
- Duplicate an existing utility or framework capability.
- Treat future design as current implementation.

## Default Context

```text
Task goal
+ Capability Contract when behavior is involved
+ JAVA_RULES.md for Java
+ Nearest module RULES
+ Target code
+ Direct dependencies
+ Relevant tests
```

**Locate first. Load only what constrains the task. Change only what the task owns.**
