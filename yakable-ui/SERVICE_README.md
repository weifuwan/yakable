# Frontend Service 规范

1. 所有后端接口统一放 `src/service`，按领域分目录；Component、Page、Hook 禁止直接调用 `fetch`。
2. 调用链固定为 `UI -> Domain Service -> HttpUtils -> Backend`，不增加 interface / impl / adapter 等无意义层级。
3. 普通 HTTP 统一走 `HttpUtils.get/post`，SSE 统一走 `HttpUtils.postSse`。
4. `HttpUtils` 只负责传输：HTTP、后端 `Result<T>`、JSON、网络错误和 SSE framing，不包含 Project / Session 业务语义。
5. 后端 `Result<T>` 只存在于 HttpUtils 内部；Domain Service 直接返回 `data`，UI 不感知统一包装。
6. Endpoint、请求参数、响应校验和 SSE 业务事件由对应 Domain Service 负责。
7. API Contract 类型放在 `service/<domain>/types.ts`，Feature 不重复定义接口类型。
8. Service 方法名与后端业务语义保持一致，例如 `addProject / queryProject / querySession / streamingTurn`。
9. AbortSignal 由调用方传入并透传，取消请求不转换成业务错误。
10. 新增接口时优先扩展现有 Domain Service 和 HttpUtils，禁止重新封装第二套请求工具。
