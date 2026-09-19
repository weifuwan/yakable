# yakable-bom

## Purpose

Own dependency-version alignment for the Yakable Maven reactor.

## Owns

- centrally managed dependency versions
- Yakable module version alignment
- third-party dependency management that should be consistent across modules

## Does not own

- runtime code
- Spring bean configuration
- module-specific dependency declarations
- business or Harness rules

## Key entry point

```text
pom.xml
```

## Dependency boundary

This is a Maven BOM, not a runtime module. Other modules consume its dependency management through the root build.

## Add to context when

Load this module for version upgrades, dependency alignment, or a build problem caused by managed versions.

Do not load it for normal runtime behavior.
