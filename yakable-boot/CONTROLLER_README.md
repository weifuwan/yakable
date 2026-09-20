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

## 方法命名

14. Controller 方法保持业务语义，统一使用 `add + 领域名`、`update + 领域名`、`delete + 领域名`、`query + 领域名`；HTTP 动词由注解表达，不在 URL 中重复动作。

## 异常

15. Controller 不使用 `try/catch` 统一包装异常，不向前端返回 SQL、数据库异常、堆栈或内部实现信息。业务异常直接抛出，由全局 `GlobalExceptionHandler` 统一处理。

## 代码格式

16. Controller 保持薄层。能直接调用 Service 返回结果时不要增加临时变量、重复转换和无意义包装；简单方法能一行写完就一行写完。
