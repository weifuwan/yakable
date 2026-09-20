# Controller 开发规范

## 职责

1. Controller 只负责 HTTP 协议层：接收请求、参数校验、调用 Service、返回结果。禁止在 Controller 中编写业务逻辑，禁止直接调用 Repository、Mapper。

2. Controller 统一放在 `yakable-boot` 的 `controller.<domain>` 包下，一个业务领域对应自己的 Controller。

## RESTful

3. 接口统一采用 RESTful 风格，URL 使用资源名，不在路径中写 `add`、`update`、`delete`、`query` 等动作。

4. 新增资源使用 `POST`。

5. 更新资源使用 `PUT`。

6. 查询资源使用 `GET`。

7. 删除资源使用 `DELETE`。

8. 资源路径统一使用名词和复数形式，例如 `/api/projects`、`/api/projects/{projectId}/sessions`。

## 依赖注入

9. Controller 依赖 Service 统一使用 `@Resource` 注入，不使用构造方法注入，不在 Controller 中手工创建 Service。

## DTO / VO

10. Controller 的业务入参统一使用 DTO，DTO 放在 `yakable-common` 的 `bean.dto.<domain>` 下。禁止把多个业务参数以 `String`、`Integer`、`Long` 等基础类型直接传给 Service。

11. `POST / PUT` 请求体统一使用 DTO；需要校验时使用 Jakarta Validation，并在 Controller 入口使用 `@Valid`。

12. `GET / DELETE` 的路径参数、查询参数属于 HTTP 路由参数，可以在 Controller 边界接收，但进入 Service 前必须统一转换为 DTO，Service 不接收零散的基础类型业务参数。

13. Controller 的业务返回值统一使用 VO，VO 放在 `yakable-common` 的 `bean.vo.<domain>` 下。分页统一返回 `PageData<VO>`，禁止直接返回 Entity、DTO、Map 或数据库对象。

## Swagger

14. Controller 接口文档统一使用 Swagger 3 / OpenAPI 3 注解，只使用 `io.swagger.v3.oas.annotations`，禁止引入 Swagger 2 / Springfox 注解。

15. 每个 Controller 必须使用 `@Tag` 描述所属领域；`name` 使用稳定的领域名称，`description` 简要说明该 Controller 提供的能力。

16. 每个对外 HTTP 方法必须使用 `@Operation`，至少填写 `summary`。文案直接描述业务动作，例如“分页查询 Project”“新增 Turn”，禁止写无意义的“接口”“API”或重复 URL 信息。

17. `@PathVariable`、`@RequestParam` 等路由参数在语义不够明确时使用 `@Parameter` 补充说明；框架和参数名已经能够清楚表达时不重复写注解。

18. 请求 DTO、返回 VO 的字段说明统一使用 `@Schema` 写在 DTO / VO 定义中，不在 Controller 中重复描述对象字段。Controller 只描述接口本身。

19. 正常响应模型由方法返回类型交给 springdoc 自动推断。只有接口存在特殊 HTTP 状态或需要明确说明的业务响应时才使用 `@ApiResponse`；禁止每个接口机械重复声明相同的 200、400、500。

20. Swagger 文案只描述对调用方有意义的业务语义，禁止暴露表名、SQL、Mapper、Repository、内部异常类、数据库实现等内部细节。

## 方法命名

21. Controller 方法保持业务语义，统一使用 `add + 领域名`、`update + 领域名`、`delete + 领域名`、`query + 领域名`；HTTP 动词由注解表达，不在 URL 中重复动作。

## 异常

22. Controller 不使用 `try/catch` 统一包装异常，不向前端返回 SQL、数据库异常、堆栈或内部实现信息。业务异常直接抛出，由全局 `GlobalExceptionHandler` 统一处理。

## 代码格式

23. Controller 保持薄层。能直接调用 Service 返回结果时不要增加临时变量、重复转换和无意义包装；简单方法能一行写完就一行写完。
