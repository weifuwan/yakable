# yakable-common

## Purpose

Own small, business-agnostic shared primitives that are safe to reuse across low-level modules.

## Owns

- generic value types
- generic framework-independent utilities
- shared primitives with no Yakable business meaning

## Does not own

- Project/Session/Turn logic
- model orchestration
- persistence helpers tied to Yakable entities
- generic dumping-ground utilities such as `ProjectUtils`, `SessionUtils`, or `ModelUtils`

## Dependency boundary

Keep this module lightweight and inward-safe. Business modules may depend on it when a primitive is genuinely generic.

## Add to context when

Load this module only when the referenced shared primitive materially affects the task.

An empty or small Common module is healthy; do not invent shared abstractions just to reuse code once.
