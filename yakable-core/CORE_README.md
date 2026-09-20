# Core 开发规范

本规范只定义 `yakable-core` 边界，通用 Java 规则遵循根目录 `JAVA_GLOBAL_CODE_README.md`。

## Core 边界

1. Core 只定义 Yakable 稳定运行时契约，不负责 Controller、业务编排、数据库访问和具体 Provider 实现。

2. Core 保持纯 Java，禁止 Spring / Spring Boot 及 `@Resource` 等容器注解；Bean 装配、配置读取放在 Boot 或 Service。

3. Core Contract 是内部稳定边界。上层只依赖 Core，Provider / Plugin 负责适配 Core，禁止让外部协议反向定义 Core。

## 设计文档

LLM 设计见：

```text
yakable-core/src/main/java/io/yakable/core/llm/LLM_DESIGN.md
```
