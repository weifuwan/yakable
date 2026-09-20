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
