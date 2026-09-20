# Service 开发规范

本规范只定义 Service 层规则，通用 Java 规则遵循根目录 `JAVA_GLOBAL_CODE_README.md`。

## 职责

1. 每张业务表对应一个 Service。Service 只负责本领域业务；需要其他表能力时调用对应 Service，禁止直接调用其他表 Repository 或 Mapper。

2. Service 接口只暴露真实业务能力，不为形式统一补无意义 CRUD；不提供 `BaseService / BaseServiceImpl`。

3. 增删改查统一使用 `add + 领域名`、`delete + 领域名`、`update + 领域名`、`query + 领域名` 命名。

## 接口与实现

4. 每个业务 Service 使用 `XxxService + impl/XxxServiceImpl`。Spring 注解只放 Impl；Controller 和其他 Service 只依赖接口。

5. ServiceImpl 只直接依赖本表 Repository；依赖注入统一使用 `@Resource`，字段使用接口类型，禁止直接注入其他 `XxxServiceImpl`。

6. 只有存在独立策略、复用价值或明确边界时才拆内部组件；仅做转发、线程提交、异常包装的组件不单独拆类。

## DTO / VO

7. 对外业务输入使用 `bean.dto.<domain>` DTO，参数校验使用 Jakarta Validation；Controller 用 `@Valid`，需要方法级校验时 ServiceImpl 用 `@Validated`。

8. 对外返回统一使用 `bean.vo.<domain>` VO，禁止直接返回 Entity、DTO 或内部对象。分页使用公共 `PageDTO`，有额外条件时业务 DTO 继承它。

9. 已通过 DTO 校验的输入不在 Service 重复判空或静默 `trim / strip`；ID、provider、model、prompt、content 等值默认保持原值，只有明确业务规则才规范化。

## LLM

10. LLM 调用统一依赖 `yakable-core` 的 `LlmClient / LlmRequest / LlmResponse`，禁止直接依赖具体 Provider、Model Plugin 或重新定义第二套 LLM 协议。

## 异常

11. 每个领域原则上只保留一个 `XxxException`，具体原因使用 `XxxErrorCode`；业务错误禁止使用 `IllegalArgumentException / IllegalStateException` 表达。
