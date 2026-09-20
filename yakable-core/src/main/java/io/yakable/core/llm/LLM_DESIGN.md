# LLM 设计
1. 目标：固定 Yakable 的 LLM 输入输出，Service 不依赖具体 Provider / Protocol。
2. 调用链：Service -> LlmClient -> LlmProvider -> Provider / Protocol。
3. 输入：LlmRequest(provider, model, system, messages)，不包含 API Key、Base URL 等运行时配置。
4. 非流式输出：LlmResponse(provider, model, content, usage, providerRequestId, finishReason)。
5. 流式输出：streamingChat 只产生 DELTA / COMPLETE，COMPLETE 携带完整 LlmResponse。
6. LlmClient 是业务入口；LlmProvider 负责 Provider 适配；Protocol Client 负责 HTTP、鉴权、JSON、SSE。
7. Core 只定义稳定 Contract，不负责 Spring 装配和具体 Provider 实现。
8. 当前支持 Chat / Streaming Chat；Tool Call、Retry、Fallback、自动路由等有真实需求再扩展。
