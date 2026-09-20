# yakable-service 开发规范

1. Service 类和核心业务方法必须有必要注释，不能出现无注释的核心业务类。

2. 同字段对象之间的类型转换优先使用 `BeanUtils.copyProperties` 这类统一复制方式，不手写重复的 `toXxx` 字段赋值代码。

3. 分页对象属于公共能力，统一放到 `yakable-common`，业务 Service 中不再定义 `XxxPage`。

4. 不写没有实际意义的 `Objects.requireNonNull`，只有确实需要在当前边界校验空值时才使用。

5. 业务异常统一使用 `BusinessException`，不直接使用 `IllegalArgumentException`、`IllegalStateException` 等异常表达业务错误。
