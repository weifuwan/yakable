# Frontend Service Rules

Scope:
- `yakable-ui/src/service/**`

Depends On:
- `./FRONTEND_RULES.md`
- 行为变化时加载 `./TEST_RULES.md`

Owns:
- Backend API 调用
- HTTP / SSE 业务协议边界
- 前端 API Contract 类型

## Flow

```text
UI / Feature
→ Domain Service
→ HttpUtils
→ Backend API
```

## Must

- 所有后端接口放在 `src/service`，按领域分目录。
- 普通 HTTP 统一走 `HttpUtils.get/post`。
- SSE 统一走 `HttpUtils.postSse`。
- `HttpUtils` 只负责 HTTP、后端 `Result<T>`、JSON、网络错误和 SSE framing。
- Domain Service 负责 endpoint、请求参数、响应 Contract、响应校验和 SSE 业务事件。
- 后端 `Result<T>` 只存在于 HttpUtils 内部；Domain Service 直接向 UI 返回业务 data。
- API Contract 类型放在 `service/<domain>/types.ts`。
- Service 方法名与后端业务语义保持一致，如 `addProject / queryProject / querySession / streamingTurn`。
- `AbortSignal` 由调用方传入并透传。
- 取消请求保持取消语义，不转换成领域业务错误。
- 新增接口优先扩展已有 Domain Service / HttpUtils。

## Must Not

- Component、Page、Hook 直接调用 `fetch`。
- 在 Feature 重复定义已有 API Contract 类型。
- 让 HttpUtils 知道 Project / Session 等业务语义。
- 让 UI 感知后端统一 `Result<T>` 包装。
- 新增第二套 HTTP / SSE 请求工具。
- 为 Domain Service 再增加 interface / impl / adapter 层。

## Tests

- Domain Service 测请求 URL、参数、Body、成功 / 失败处理和 SSE 业务事件解析。
- Service Test Mock network，不访问真实后端。
- 测试规则遵循 `TEST_RULES.md`。

## Boundary

Service 拥有前端到后端的协议边界，不拥有产品 UI 状态和组件交互。
