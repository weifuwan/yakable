# Yakable

Yakable is a frontend-domain Harness for building and editing frontend applications with stronger engineering boundaries and less model guesswork.

## Repository structure

```text
yakable/
├── yakable-boot/            # Controller + Spring Boot
├── yakable-service/         # Project / Session business logic
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

Module dependency:

```text
yakable-boot
    ↓
yakable-service
    ↓
yakable-dao
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
