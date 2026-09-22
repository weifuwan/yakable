# Service Rules

Scope:
- `yakable-service/**`

Depends On:
- `/JAVA_RULES.md`
- `/BACKEND_TEST_RULES.md`
- `/yakable-common/COMMON_RULES.md`
- `/yakable-dao/REPOSITORY_RULES.md`
- 涉及 LLM / Runtime Contract 时加载 `/yakable-core/CORE_RULES.md`

Owns:
- 领域业务规则
- 领域编排
- 状态流转
- 面向事务的业务流程

## Must

- 每个业务领域 / 主表边界维护一个 Service。
- 使用 `XxxService + impl/XxxServiceImpl`。
- Spring 实现注解只放 Impl。
- Controller 和其他 Service 只依赖 Service 接口。
- ServiceImpl 只直接访问本领域 Repository。
- 跨领域业务通过其他 Service 接口协作。
- 依赖统一使用 `@Resource` 和接口类型。
- Service 只暴露真实业务能力，不为了形式统一补 CRUD。
- 方法使用 `addXxx / deleteXxx / updateXxx / queryXxx` 等业务语义。
- 输入统一使用 `bean.dto.<domain>` DTO。
- 使用 Jakarta Validation；Controller 用 `@Valid`，需要方法级校验时 Impl 可用 `@Validated`。
- 对外返回 VO，不返回持久化对象。
- 分页复用公共 `PageDTO / PageData`。
- DTO / Entity / VO 转换优先复用 Common 转换能力。
- 已校验用户输入默认保持原值，不静默 `trim / strip`，除非产品 Contract 明确要求归一化。
- LLM 调用依赖 Core 的 `LlmClient / LlmRequest / LlmResponse`。
- 每个领域保持一套异常体系，具体业务原因使用稳定错误码。

## Must Not

- 引入 `BaseService / BaseServiceImpl`。
- 注入其他 `XxxServiceImpl`。
- 直接访问其他领域 Repository / Mapper。
- 返回 Entity、DTO 或内部持久化对象。
- 依赖具体 LLM Provider / Model Plugin。
- 重新定义第二套 LLM 协议。
- 用 `IllegalArgumentException / IllegalStateException` 表达业务错误。
- 为纯转发、线程提交、异常包装拆独立组件。
- 对已验证输入重复判空或重复转换。

## Tests

业务规则、状态流转、失败分支和 Bug Fix 必须按 `BACKEND_TEST_RULES.md` 补回归测试。

## Boundary

Service 拥有业务行为；HTTP 属于 Controller；持久化机制属于 Repository；稳定 LLM 协议属于 Core。
