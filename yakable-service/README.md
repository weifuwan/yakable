# yakable-service 开发规范

1. Service 类和核心业务方法必须有必要注释，不能出现无注释的核心业务类。

2. 对象类型转换统一使用 `ConverUtils`，业务代码不手写重复的 `toXxx` 字段转换，也不直接散落调用 `BeanUtils.copyProperties`。

3. `ConverUtils` 放到 `yakable-common`，提供泛型对象转换能力，例如传入源对象和目标 `Class<T>`，统一返回目标类型对象。

4. 时间类型统一使用 `LocalDateTime`，不混用 `Date`、`Instant`、`Timestamp` 等时间类型。

5. 时间格式化、解析、转换等公共处理统一放到 `DateUtils`，`DateUtils` 放到 `yakable-common`。

6. 分页对象属于公共能力，统一放到 `yakable-common`，业务 Service 中不再定义 `XxxPage`。

7. 不写没有实际意义的 `Objects.requireNonNull`，只有确实需要在当前边界校验空值时才使用。

8. 字符串判空、判空白等通用处理统一使用 Apache Commons Lang 的 `StringUtils`，不重复封装 `requireText`、`isBlank` 等字符串工具方法。

9. 业务异常统一使用 `BusinessException`，不直接使用 `IllegalArgumentException`、`IllegalStateException` 等异常表达业务错误。

10. 依赖注入统一使用 `@Resource`，不手写仅用于依赖注入的构造方法。

11. 增删改查方法统一使用 `add + 领域名`、`delete + 领域名`、`update + 领域名`、`query + 领域名` 命名，例如 `addProject`、`deleteProject`、`updateProject`、`queryProject`。

12. add / delete / update / query 的输入参数统一封装为 DTO，不直接堆多个基础参数；DTO 按操作和领域命名，例如 `AddProjectDTO`、`DeleteProjectDTO`、`UpdateProjectDTO`、`QueryProjectDTO`。

13. DTO 参数校验统一使用 Jakarta Validation 注解，例如字符串必填使用 `@NotBlank`、对象必填使用 `@NotNull`、长度限制使用 `@Size`；Controller 入参使用 `@Valid` 触发校验，不在业务代码中重复写 `if (StringUtils.isBlank(...))` 后手动抛异常。

14. 如果需要在 Service 方法参数层执行 Jakarta Validation，Service 使用 `@Validated` 开启方法级校验。

15. DTO 统一放到 `yakable-common` 模块，不在 Service、Controller 等业务模块中重复定义 DTO。

16. 对外返回对象统一使用 VO，不直接返回 Entity、DTO 或 Service 内部对象。

17. VO 按实际页面或展示领域命名，不按数据库表或接口动作机械命名，例如项目列表页面使用 `ProjectListVO`，项目详情页面使用 `ProjectDetailVO`。

18. VO 统一放到 `yakable-common` 模块，作为跨模块共享的返回数据结构。

19. `yakable-common` 下统一建立 `bean` 包，DTO 和 VO 分别放到 `bean.dto`、`bean.vo` 中。

20. 公共 Bean 目录统一保持如下结构：

```text
io.yakable.common.bean
├── dto
└── vo
```
