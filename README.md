# Yakable

Yakable is a frontend-domain Harness for building and editing frontend applications with stronger engineering boundaries and less model guesswork.

## Coding conventions

- [JAVA_GLOBAL_CODE_README.md](./JAVA_GLOBAL_CODE_README.md)：所有 Java 代码必须遵循的通用规范。
- [BACKEND_TEST_README.md](./BACKEND_TEST_README.md)：Spring Boot 后端测试规范。
- [yakable-service/SERVICE_README.md](./yakable-service/SERVICE_README.md)：Service 专属规范。
- [yakable-core/CORE_README.md](./yakable-core/CORE_README.md)：Core 专属规范。
- [yakable-common/COMMON_CODE.md](./yakable-common/COMMON_CODE.md)：Common 专属规范。
- [yakable-dao/ENTITY_README.md](./yakable-dao/ENTITY_README.md)：Entity 规范。
- [yakable-dao/REPOSITORY_README.md](./yakable-dao/REPOSITORY_README.md)：Repository / Mapper 规范。
- [yakable-dao/FLYWAY_README.md](./yakable-dao/FLYWAY_README.md)：数据库 Migration 规范。

## Repository structure

```text
yakable/
├── yakable-boot/            # Controller + Spring Boot
├── yakable-service/         # Project / Session business logic
├── yakable-core/            # Stable runtime contracts such as LLM
├── yakable-dao/             # Repository + Mapper + Entity + Flyway
├── yakable-plugins/         # Model provider plugins
├── yakable-common/          # Shared code
├── yakable-bom/             # Dependency alignment
├── yakable-ui/              # React frontend
├── templates/               # Generated frontend foundation
└── docs/
```

## Backend

Requirements:

- Java 21
- MySQL 8+
- Maven Wrapper

Build:

```bash
./mvnw package
```

Run:

```bash
export YAKABLE_DB_USERNAME=root
export YAKABLE_DB_PASSWORD=your-password
export DEEPSEEK_API_KEY=your-api-key

./mvnw -pl yakable-boot -am spring-boot:run
```

Runtime database configuration:

```text
YAKABLE_DB_URL
YAKABLE_DB_USERNAME
YAKABLE_DB_PASSWORD
```

Model configuration:

```text
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
```

SSE configuration:

```text
YAKABLE_SSE_TIMEOUT   # default: 10m
```

Runtime configuration:

```text
YAKABLE_RUNTIME_MODE      # SaaS V1 only supports: single-instance
YAKABLE_SHUTDOWN_TIMEOUT  # default: 30s
```

Yakable SaaS V1 must run as a single backend instance. Current Streaming Snapshot, watcher state and Stop coordination are process-local; multi-instance deployment is intentionally not supported yet.

Session Context uses the active Model Plugin context window and Provider token estimator to select complete historical turns. History is read backward in bounded batches, and the current user turn is never silently truncated.

## Backend structure

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Mapper
    ↓
Entity
```

LLM 调用使用独立的稳定边界：

```text
Service
    ↓
yakable-core / LlmClient
    ↓
LlmProvider
    ↓
Model Plugin
```

Model providers remain independent plugins discovered through AutoService / ServiceLoader.

Flyway migrations live in:

```text
yakable-dao/src/main/resources/db/migration/yakable
```

## Frontend

```bash
cd yakable-ui
npm install
npm run dev
```

The frontend development server proxies `/api` to Spring Boot on port `8080`.

## Current principle

**先保持简单，复杂度真实出现以后再拆。**
