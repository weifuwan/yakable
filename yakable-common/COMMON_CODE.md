# Common 开发规范

本规范只定义 `yakable-common` 边界，通用 Java 规则遵循根目录 `JAVA_GLOBAL_CODE_README.md`。

## 职责

1. Common 只放跨模块复用的数据对象、工具、常量、枚举和异常，禁止放具体业务逻辑。

2. DTO、VO、枚举按领域分包：`bean.dto.<domain>`、`bean.vo.<domain>`、`enums.<domain>`；真正跨领域对象放 `common` 子包。

3. DTO 按操作和领域命名；纯分页使用公共分页 DTO。VO 按实际展示语义命名，不按数据库表机械命名。

## 公共能力

4. 字符串、JSON、对象转换、时间、ID、线程等跨模块能力统一放 `utils`，其他模块统一复用，禁止各自创建或维护同类实现。

5. 时间类型统一使用 `LocalDateTime`；需要持久化的枚举使用 `@EnumValue` 保存数字值，业务代码直接使用枚举。

6. 公共常量统一放 `constant`，领域枚举和错误码统一放对应领域包，禁止多个模块重复定义同一语义。

## 异常与返回

7. Common 统一承载错误码契约、业务异常、领域异常和领域错误码；同一领域只保留一套异常体系。HTTP 返回结构和通用状态码同样只维护一套。

## OpenAPI

8. DTO、VO 统一使用 Swagger 3 `@Schema` 描述类型和对外字段；description 写业务语义，不描述 Entity、Mapper 等内部实现。

9. 必填、长度、范围由 Jakarta Validation 表达，`@Schema` 不重复维护校验规则；example 只用于稳定且有帮助的示例。
