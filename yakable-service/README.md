# yakable-service 开发规范

## Service 职责

1. Service 接口和公开业务方法必须有必要注释，明确业务职责和关键流程。

2. 每张业务表都必须有对应的 Service，Service 只负责自己这张表及其业务能力。一个 Service 如果需要调用其他表的业务逻辑，只能依赖对应的 Service，禁止跨过 Service 直接调用其他表的 Repository 或 Mapper。例如 SessionService 需要 Turn 或 Message 能力时，只能调用 TurnService、MessageService。

3. 增删改查方法统一使用 `add + 领域名`、`delete + 领域名`、`update + 领域名`、`query + 领域名` 命名。

## 目录与实现

4. 每个业务 Service 统一拆分为接口和实现类。接口命名为 `XxxService`，实现类命名为 `XxxServiceImpl`。

5. `XxxService` 放在对应领域包下，`XxxServiceImpl` 统一放在对应领域的 `impl` 子包下。

6. `@Service`、`@Validated` 等 Spring 实现相关注解只放在 `XxxServiceImpl`，Service 接口保持纯业务契约。

7. Controller 和其他 Service 统一依赖 `XxxService` 接口，禁止直接依赖 `XxxServiceImpl`。

8. Service 接口中的公开业务方法必须写必要注释，说明该方法提供的业务能力；`XxxServiceImpl` 中对应实现方法不重复写相同注释。

9. ServiceImpl 依赖注入统一使用 `@Resource`，字段类型统一使用接口类型，不手写仅用于依赖注入的构造方法，禁止直接注入其他 `XxxServiceImpl`。

10. Service 接口只声明真实存在的业务能力，不为了形式统一增加无意义的 CRUD 方法。

11. `TurnDispatcher`、`TurnExecutor`、`TurnRecoveryWorker` 等内部执行组件不属于业务 Service，不要求为了统一形式额外拆分 interface 和 impl。

12. Service 层暂不提供 `BaseService`、`BaseServiceImpl`。通用数据库 CRUD 已由 Repository 层负责，Service 层只表达业务能力，禁止再封装一层通用 CRUD。

## DTO 与参数校验

13. add / delete / update / query 的输入参数统一封装为 DTO，不直接堆多个基础参数；DTO 按操作和领域命名，并统一放到 `yakable-common.bean.dto.<domain>`。

14. DTO 参数校验统一使用 Jakarta Validation；Controller 使用 `@Valid` 触发校验，需要 Service 方法级校验时使用 `@Validated`。业务代码不重复手写字符串判空后再抛异常。

## VO 与分页

15. 对外返回对象统一使用 VO，不直接返回 Entity、DTO 或 Service 内部对象；VO 按实际页面或展示领域命名，并统一放到 `yakable-common.bean.vo.<domain>`。

16. 分页属于公共能力。纯分页参数统一使用 `yakable-common.bean.dto.common` 下的公共 `PageDTO`；业务查询存在额外筛选条件时，对应 DTO 继承 `PageDTO` 并只补充领域字段；Service 中不再定义 `XxxPage` 或重复声明 `current`、`pageSize`。

## 公共能力

17. DTO 转 Entity、Entity 转 VO 时优先使用 `ConverUtils` 完成同名且类型兼容的字段转换。`ConverUtils` 已经完成的字段禁止再次 `set` 覆盖；只有字段名不一致、类型不兼容、嵌套对象、派生字段、默认值、状态初始化、时间字段等无法直接转换的场景才单独处理。禁止转换后再把同名字段逐个复制一遍，也不在业务代码中直接散落调用 `BeanUtils.copyProperties`。

18. 时间类型统一使用 `LocalDateTime`；时间格式化、解析、转换等公共处理统一使用 `DateUtils`，不混用 `Date`、`Instant`、`Timestamp`。

19. 字符串合法性优先通过 DTO 的 Jakarta Validation 提前校验，Service 不对已经通过校验的入参统一做 `strip / trim`，也不使用 `StringUtils` 做重复判空或静默清洗。ID、provider、model 等精确值以及 prompt、content 等原始用户输入默认保持原值；只有业务明确要求规范化的派生字段或持久化字段，才在唯一入口单独处理。需要限制首尾空白等格式时优先通过 DTO 校验规则表达，而不是在 Service 中偷偷修改值。

## 异常与防御性代码

20. 每个业务领域原则上只定义一个领域异常，例如 `SessionException`；具体错误原因统一通过 `XxxErrorCode implements ErrorCode` 表达。领域异常统一继承 `BusinessException`，领域异常和对应的错误码枚举统一放到 `yakable-common`，Service 只负责直接抛 `new XxxException(XxxErrorCode.XXX)`，不在业务模块重复定义异常或错误码，也不使用 `IllegalArgumentException`、`IllegalStateException` 表达业务错误。

## 代码格式

21. 简单方法声明、构造方法和方法调用能一行写完就一行写完；只有参数较多或单行明显过长时才允许换行，换行后必须保持结构紧凑、统一。

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
