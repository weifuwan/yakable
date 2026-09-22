# Controller Rules

Scope:
- `yakable-boot/src/main/java/**/controller/**`

Depends On:
- `/JAVA_RULES.md`
- `/BACKEND_TEST_RULES.md`
- `/yakable-common/COMMON_RULES.md`

Owns:
- HTTP 边界
- 请求校验
- HTTP 响应 Contract
- OpenAPI 接口描述

## Must

- Controller 只负责接收请求、参数校验、调用 Service、返回结果。
- Controller 放在 `controller.<domain>`。
- REST URL 使用复数资源名，不在路径中写 add / update / delete / query。
- 新增用 POST，更新用 PUT，查询用 GET，删除用 DELETE。
- 通过 `@Resource` 注入 Service 接口。
- 业务入参使用 `yakable-common.bean.dto.<domain>` DTO。
- 需要校验的请求使用 Jakarta Validation 和 `@Valid`。
- GET / DELETE 路由参数如果进入业务层，先转换为 DTO。
- 对外业务数据使用 `yakable-common.bean.vo.<domain>` VO。
- 普通返回统一 `Result<VO>`，分页使用 `Result<PageData<VO>>`，无数据使用 `Result<Void>`。
- 成功统一 `Result.success(...)`。
- 失败统一交给 `GlobalExceptionHandler + Result.fail(...)`。
- HTTP Status 表达协议状态，`Result.code` 表达稳定业务错误码。
- 只使用 Swagger 3 / OpenAPI 3。
- 每个 Controller 使用 `@Tag`，每个对外方法使用 `@Operation(summary = ...)`。
- DTO / VO 字段说明写在 `@Schema`，Controller 只描述接口本身。
- 正常响应模型交给 springdoc 自动推断。
- 方法名保持业务语义，如 `addProject / updateProject / deleteProject / queryProject`。
- 简单 Controller 方法保持直接、紧凑。

## Must Not

- 在 Controller 写业务逻辑。
- 直接调用 Repository / Mapper。
- 手工创建 Service。
- 用一组零散基础类型代替稳定 DTO 业务输入。
- 返回 Entity、DTO、Map 或数据库对象。
- 自定义第二套返回包装。
- 手工拼失败响应。
- 为统一异常包装增加 Controller `try/catch`。
- 向前端暴露 SQL、表名、Mapper、Repository、堆栈和数据库实现。
- 使用 Swagger 2 / Springfox。
- 机械重复声明相同 200 / 400 / 500 `@ApiResponse`。

## Tests

HTTP Contract 变化必须加载 `BACKEND_TEST_RULES.md`，通常使用 `@WebMvcTest + MockMvc` 保护。

## Boundary

Controller 只拥有协议转换；业务规则属于 Service。
