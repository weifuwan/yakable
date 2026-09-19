# Yakable

Yakable is a frontend-domain Harness for building and editing frontend applications with stronger engineering boundaries and less model guesswork.

The backend is being rebuilt in Java. The previous TypeScript backend has been removed instead of being maintained as a compatibility layer.

## Repository structure

```text
yakable/
├── yakable-bom/       # Java dependency alignment
├── yakable-common/    # Framework-independent shared types and utilities
├── yakable-spi/       # Stable ports and extension contracts
├── yakable-plugins/   # AutoService + ServiceLoader extension implementations
├── yakable-core/      # Frontend Harness domain capabilities and runtime coordination
├── yakable-boot/      # Spring Boot application and HTTP adapters
├── yakable-ui/        # React + TypeScript browser application
├── templates/         # Frontend project templates and capability assets
└── docs/              # Architecture documentation
```

## Backend

Requirements:

- Java 21
- Maven Wrapper is included

Build:

```bash
./mvnw test
```

Run:

```bash
export DEEPSEEK_API_KEY=your-api-key
./mvnw -pl yakable-boot -am spring-boot:run
```

The first built-in model plugin is DeepSeek. Plugins are registered with AutoService and discovered at runtime through Java ServiceLoader. The backend reads:

```text
DEEPSEEK_API_KEY       required for LLM calls
DEEPSEEK_BASE_URL      optional, defaults to https://api.deepseek.com
```

The backend dependency direction is:

```text
yakable-boot
├──> yakable-core
│      ├──> yakable-spi
│      │      └──> yakable-common
│      └──> yakable-plugin-model-api
│
└──> yakable-plugin-model-all
       └──> yakable-plugin-model-deepseek
              ├──> yakable-plugin-model-api
              └──> yakable-plugin-model-openai-compatible
                     └──> yakable-plugin-model-api
```

Core depends only on the stable model plugin API. Concrete providers are discovered through ServiceLoader and are not imported by Core or Boot.

The interaction domain is explicitly separated:

```text
Project -> Session -> Turn -> Message
```

Project is the long-lived workspace, Session owns conversation/model context, Turn owns execution lifecycle, and Message is the ordered conversational record. See `docs/architecture/session-domain.md`.

`yakable-bom` manages dependency versions and is not part of the runtime dependency chain.

## Frontend

```bash
cd yakable-ui
npm install
npm run dev
```

The frontend development server proxies `/api` to Spring Boot on port `8080`.

## Current baseline

The Java modules currently establish the engineering skeleton only. Existing product APIs will be rebuilt incrementally in Java rather than copied mechanically from the removed TypeScript backend.

Browser-only behavior remains in `yakable-ui`; backend orchestration and Harness capabilities belong in Java.
