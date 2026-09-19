# yakable-boot

## Purpose

Own application composition and runtime configuration.

## Owns

- Spring Boot entry point
- bean wiring
- runtime configuration properties
- composition of Application, DAO, Infrastructure, Interfaces, and plugins

## Does not own

- business rules
- use-case orchestration
- repository/Mapper implementation
- REST endpoint logic
- provider protocol logic

## Key entry points

```text
src/main/java/io/yakable/boot/YakableApplication.java
src/main/java/io/yakable/boot/configuration/
├── ApplicationConfiguration.java
├── AsyncConfiguration.java
├── ModelConfiguration.java
└── properties/
```

Integration tests also live under:

```text
src/test/java/io/yakable/boot/
```

## Dependency boundary

Boot is the composition root and may depend on runtime modules. Runtime modules must not depend on Boot.

## Add to context when

Load this module for bean wiring, properties, startup/runtime configuration, or end-to-end HTTP integration tests.

Do not move a business rule here merely because Spring makes it convenient.
