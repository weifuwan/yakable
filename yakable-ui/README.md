# Yakable UI

Yakable 浏览器应用。

## Development

```bash
npm install
npm run dev
```

Vite 开发服务器将 `/api` 代理到：

```text
http://127.0.0.1:8080
```

## Context

修改前端代码时按任务加载：

- [FRONTEND_RULES.md](./FRONTEND_RULES.md) — 全局前端代码规则。
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 当前目录、ownership 和依赖方向。
- [SERVICE_RULES.md](./SERVICE_RULES.md) — Backend API / HTTP / SSE 规则。
- [TEST_RULES.md](./TEST_RULES.md) — 前端测试规则。
- [src/features/FEATURE_RULES.md](./src/features/FEATURE_RULES.md) — Feature ownership。
- [src/shared/ui/UI_RULES.md](./src/shared/ui/UI_RULES.md) — Shared UI Primitive。
- [src/shared/lib/LIB_RULES.md](./src/shared/lib/LIB_RULES.md) — Shared helper。
- [docs/tooling.md](./docs/tooling.md) — Oxlint / Oxfmt / TypeScript / Vitest 工具事实。

## Source

```text
src/
├── app/
├── assets/
├── pages/
├── features/
├── service/
└── shared/
```

浏览器原生交互留在本模块。

后端领域逻辑、模型集成、Project 编排、持久化和 Harness Runtime 属于 Java 模块。

## Verification

```bash
npm run check
npm run build
```

开发中可以使用：

```bash
npm run lint:fix
npm run format
npm run test:watch
```
