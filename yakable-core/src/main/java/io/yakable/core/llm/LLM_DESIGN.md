# LLM 设计
1. 目标：固定 Yakable 的 LLM 输入输出，Service 不依赖具体 Provider / Protocol。
2. 调用链：Service -> LlmClient -> LlmProvider -> Provider / Protocol。
3. 输入：LlmRequest(provider, model, system, messages)，不包含 API Key、Base URL 等运行时配置。
4. 输出：LlmResponse(provider, model, content, usage, providerRequestId, finishReason)。
5. LlmClient 是业务统一入口；LlmProvider 负责 Provider 适配；Protocol Client 负责 HTTP、鉴权、JSON 等协议细节。
6. Core 只定义稳定 Contract，不负责 Spring 装配和具体 Provider 实现。
7. 当前只支持非流式 Chat。
8. Streaming、Tool Call、Retry、Fallback、自动路由等有真实需求再扩展，且不改变 Service 调用边界。
