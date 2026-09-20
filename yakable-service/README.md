# yakable-service 开发规范

## Service 职责

1. Service 类和核心业务方法必须有必要注释，明确业务职责和关键流程。

2. 依赖注入统一使用 `@Resource`，不手写仅用于依赖注入的构造方法。

3. 增删改查方法统一使用 `add + 领域名`、`delete + 领域名`、`update + 领域名`、`query + 领域名` 命名。

## DTO 与参数校验

4. add / delete / update / query 的输入参数统一封装为 DTO，不直接堆多个基础参数；DTO 按操作和领域命名，并统一放到 `yakable-common.bean.dto.<domain>`。

5. DTO 参数校验统一使用 Jakarta Validation；Controller 使用 `@Valid` 触发校验，需要 Service 方法级校验时使用 `@Validated`。业务代码不重复手写字符串判空后再抛异常。

## VO 与分页

6. 对外返回对象统一使用 VO，不直接返回 Entity、DTO 或 Service 内部对象；VO 按实际页面或展示领域命名，并统一放到 `yakable-common.bean.vo.<domain>`。

7. 分页属于公共能力。纯分页参数统一使用 `yakable-common.bean.dto.common` 下的公共 `PageDTO`；业务查询存在额外筛选条件时，对应 DTO 继承 `PageDTO` 并只补充领域字段；Service 中不再定义 `XxxPage` 或重复声明 `current`、`pageSize`。

## 公共能力

8. DTO 转 Entity、Entity 转 VO 时优先使用 `ConverUtils` 完成同名且类型兼容的字段转换。`ConverUtils` 已经完成的字段禁止再次 `set` 覆盖；只有字段名不一致、类型不兼容、嵌套对象、派生字段、默认值、状态初始化、时间字段等无法直接转换的场景才单独处理。禁止转换后再把同名字段逐个复制一遍，也不在业务代码中直接散落调用 `BeanUtils.copyProperties`。

9. 时间类型统一使用 `LocalDateTime`；时间格式化、解析、转换等公共处理统一使用 `DateUtils`，不混用 `Date`、`Instant`、`Timestamp`。

10. 字符串判空、判空白等通用处理统一使用 Apache Commons Lang `StringUtils`，不重复封装 `requireText`、`isBlank` 等通用字符串方法。

## 异常与防御性代码

11. 每个业务领域原则上只定义一个领域异常，例如 `SessionException`；具体错误原因统一通过 `XxxErrorCode implements ErrorCode` 表达。领域异常统一继承 `BusinessException`，领域异常和对应的错误码枚举统一放到 `yakable-common`，Service 只负责直接抛 `new XxxException(XxxErrorCode.XXX)`，不在业务模块重复定义异常或错误码，也不使用 `IllegalArgumentException`、`IllegalStateException` 表达业务错误。

## 代码格式

12. 简单方法声明、构造方法和方法调用能一行写完就一行写完；只有参数较多或单行明显过长时才允许换行，换行后必须保持结构紧凑、统一。

禁止：

```java
public Optional<ProjectDetailVO> queryProject(
        @NotNull @Valid QueryProjectDTO dto
) {
```

应写成：

```java
public Optional<ProjectDetailVO> queryProject(@NotNull @Valid QueryProjectDTO dto) {
```
