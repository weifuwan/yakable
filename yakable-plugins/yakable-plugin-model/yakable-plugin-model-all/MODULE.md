# yakable-plugin-model-all

## Purpose

Provide one runtime dependency that brings all built-in Yakable model plugins onto the classpath.

## Owns

- aggregation of built-in provider plugin dependencies
- smoke tests proving built-in providers are discoverable together

## Does not own

- plugin API contracts
- provider implementation logic
- model orchestration
- provider selection policy

## Key context

```text
pom.xml
src/test/java/io/yakable/plugin/model/all/AllModelPluginsTest.java
```

## Dependency boundary

This is a runtime aggregation module. Keep implementation logic in the concrete provider modules.

## Add to context when

Load this module for provider discovery/classpath aggregation issues or when adding/removing a built-in provider from the runtime bundle.

Do not load it for a provider's internal protocol bug.
