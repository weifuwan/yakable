# yakable-common 开发规范

`yakable-common` 只放跨模块复用的公共对象、工具能力、常量、枚举和异常，不放具体业务逻辑。

## 目录规范

```text
io.yakable.common
├── bean
│   ├── dto
│   └── vo
├── utils
├── constant
├── enums
└── exception
```

1. 公共数据对象统一放在 `bean` 包。

2. 输入参数对象统一放在 `bean.dto`，返回对象统一放在 `bean.vo`。

3. DTO 按操作和领域命名；纯分页参数使用公共分页 DTO，有额外筛选条件时由业务 DTO 继承公共分页 DTO。

4. VO 按实际页面或展示领域命名，不按数据库表或接口动作机械命名。

5. 跨模块复用的工具能力统一放在 `utils`，业务模块禁止重复实现已有公共能力。

6. 对象转换统一走公共转换工具，不在业务代码中重复手写字段复制逻辑。

7. 时间类型统一使用 `LocalDateTime`；时间格式化、解析、转换等公共处理统一走公共时间工具。

8. ID 统一通过公共 ID 工具生成，业务代码禁止自行实现 ID 生成逻辑。

9. 所有线程、线程池和调度线程池统一走公共线程工具。业务模块禁止直接使用 `new Thread`、`Executors`、`ThreadFactory`、`Thread.ofVirtual()`、`Thread.ofPlatform()` 创建线程或线程池；需要新的线程模型时先在公共线程工具中增加统一能力。

10. 公共常量统一放在 `constant` 包，禁止在多个模块重复定义相同常量。

11. 公共枚举统一放在 `enums` 包；需要持久化的枚举使用 MyBatis-Plus `@EnumValue` 标记数据库数字值，业务代码直接使用枚举本身，不手动操作数据库枚举值。

12. common 提供统一的 `ErrorCode` 契约和 `BusinessException` 基类；每个业务领域只保留一个领域异常类型，放在 `exception` 包并继承 `BusinessException`。具体业务错误码由所属业务模块维护 `XxxErrorCode implements ErrorCode`，禁止把业务错误码枚举集中放入 common，也禁止为每个错误码单独创建异常类。

## 代码格式

13. 只有参数较多或单行明显过长时才允许换行；换行后必须保持结构紧凑、统一。

14. 简单方法、构造方法、record 声明、方法调用能一行写完就写一行，禁止为了一个参数做无意义换行。

15. 禁止把右括号和左花括号单独悬空，例如禁止：

```java
public Optional<ProjectDetailVO> queryProject(
        @NotNull @Valid QueryProjectDTO dto
) {
```

应写成：

```java
public Optional<ProjectDetailVO> queryProject(@NotNull @Valid QueryProjectDTO dto) {
```
