# Yakable

Yakable is a frontend-domain Harness for building and editing frontend applications with stronger engineering boundaries and less model guesswork.

The backend is being rebuilt in Java. The previous TypeScript backend has been removed instead of being maintained as a compatibility layer.

## Repository structure

```text
yakable/
├── yakable-bom/             # Java dependency alignment
├── yakable-common/          # Business-agnostic shared types and utilities
├── yakable-api/             # Domain, application, REST and infrastructure
├── yakable-dao/             # MyBatis-Plus persistence + Flyway migrations
├── yakable-plugins/         # AutoService + ServiceLoader implementations
├── yakable-boot/            # Spring Boot composition root
├── yakable-ui/              # React + TypeScript browser application
├── templates/               # Frontend project templates and capability assets
└── docs/                    # Architecture documentation
```

## Backend

Requirements:

- Java 21
- MySQL 8+
- Maven Wrapper is included

Build:

```bash
./mvnw test
```

Create an empty MySQL database named `yakable` (or point Yakable at another database). Flyway owns the application tables and migration history.

Runtime database configuration:

```text
YAKABLE_DB_URL
YAKABLE_DB_USERNAME
YAKABLE_DB_PASSWORD
```

Defaults:

```text
YAKABLE_DB_URL=jdbc:mysql://127.0.0.1:3306/yakable?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC
YAKABLE_DB_USERNAME=root
YAKABLE_DB_PASSWORD=
```

Run:

```bash
export YAKABLE_DB_USERNAME=root
export YAKABLE_DB_PASSWORD=your-password
export DEEPSEEK_API_KEY=your-api-key

./mvnw -pl yakable-boot -am spring-boot:run
```

The first built-in model plugin is DeepSeek. Plugins are registered with AutoService and discovered at runtime through Java ServiceLoader. Model configuration:

```text
DEEPSEEK_API_KEY       required for LLM calls
DEEPSEEK_BASE_URL      optional, defaults to https://api.deepseek.com
```

## Backend dependency direction

```text
yakable-boot
  ├── yakable-api
  ├── yakable-dao
  └── yakable-plugin-model-*

yakable-dao
  └── yakable-api

yakable-api
  ├── yakable-common
  └── model plugin API
```

The persistence corridor is:

```text
Repository
  -> RepositoryImpl
  -> MyBatis-Plus Mapper
  -> Entity
  -> MySQL
```

Flyway migrations live in `yakable-dao/src/main/resources/db/migration/yakable`.

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

Yakable now has explicit Domain, Application, Persistence, Infrastructure, Interface, and Boot boundaries. New backend capabilities should extend those boundaries rather than bypass them.

Browser-only behavior remains in `yakable-ui`; backend orchestration and Harness capabilities belong in Java.
