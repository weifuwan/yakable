# Core 开发规范

本规范只定义 `yakable-core` 边界，通用 Java 规则遵循根目录 `JAVA_GLOBAL_CODE_README.md`。

## Core 边界

1. Core 只定义 Yakable 稳定运行时契约，不负责 Controller、业务编排、数据库访问和具体 Provider 实现。

2. Core 保持纯 Java，禁止 Spring / Spring Boot 及 `@Resource` 等容器注解；Bean 装配、配置读取放在 Boot 或 Service。

3. Core Contract 是内部稳定边界。上层只依赖 Core，Provider / Plugin 负责适配 Core，禁止让外部协议反向定义 Core。

## LLM

4. LLM 统一入口为 `LlmClient.chat(LlmRequest)`，统一返回 `LlmResponse`。

5. `LlmRequest` 只描述 provider、model、system、messages；API Key、Base URL、HTTP Endpoint 等 Provider 配置不进入业务请求。

6. `LlmResponse` 统一承载 provider、model、content、usage、providerRequestId、finishReason；外部响应字段必须在 Provider / Protocol 层转换。

7. 当前只固定非流式 Chat Contract。Streaming、Tool Call、Fallback、Retry、自动路由等能力没有真实需求前不加入。
