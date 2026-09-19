# yakable-spi

## Purpose

Own stable extension contracts that are broader than one Application use case.

## Owns

- intentionally stable cross-module extension points
- contracts suitable for independent implementations
- SPI-level types shared by extensions

## Does not own

- ordinary Application ports
- Domain repositories
- provider-specific implementations
- speculative extension interfaces with no real implementation boundary

## Dependency boundary

Depends only on low-level shared primitives such as `yakable-common`. Keep the API stable and technology-light.

The model-provider API currently has its own dedicated contract module and does not belong here.

## Add to context when

Load this module only when a task explicitly changes or consumes a stable Yakable extension contract.

Do not load it for normal Project, Session, persistence, or model-provider work.
