# yakable-common 开发规范

`yakable-common` 只放跨模块复用的公共对象、工具能力、常量、枚举和异常，不放具体业务逻辑。

## 目录规范

```text
io.yakable.common
├── bean
│   ├── dto
│   │   └── <domain>
│   └── vo
│       └── <domain>
├── utils
├── constant
├── enums
│   └── <domain>
└── exception
```

1. 公共数据对象统一放在 `bean` 包。

2. DTO、VO、枚举都必须按领域再分一层包，禁止把不同领域的对象直接平铺在 `dto`、`vo`、`enums` 根包下。例如 Project 领域使用 `bean.dto.project`、`bean.vo.project`、`enums.project`，Session 领域使用对应的 `session` 包。

3. 输入参数对象统一放在 `bean.dto.<domain>`，返回对象统一放在 `bean.vo.<domain>`，领域枚举统一放在 `enums.<domain>`。

4. DTO 按操作和领域命名；纯分页参数使用公共分页 DTO，有额外筛选条件时由业务 DTO 继承公共分页 DTO。

5. VO 按实际页面或展示领域命名，不按数据库表或接口动作机械命名。

6. 跨模块复用的工具能力统一放在 `utils`，业务模块禁止重复实现已有公共能力。

7. 对象转换统一走公共转换工具，不在业务代码中重复手写字段复制逻辑。

8. 时间类型统一使用 `LocalDateTime`；时间格式化、解析、转换等公共处理统一走公共时间工具。

9. ID 统一通过公共 ID 工具生成，业务代码禁止自行实现 ID 生成逻辑。

10. 所有线程、线程池和调度线程池统一走公共线程工具。业务模块禁止直接使用 `new Thread`、`Executors`、`ThreadFactory`、`Thread.ofVirtual()`、`Thread.ofPlatform()` 创建线程或线程池；需要新的线程模型时先在公共线程工具中增加统一能力。

11. 公共常量统一放在 `constant` 包，禁止在多个模块重复定义相同常量。

12. 领域枚举统一放在 `enums.<domain>`；需要持久化的枚举使用 MyBatis-Plus `@EnumValue` 标记数据库数字值，业务代码直接使用枚举本身，不手动操作数据库枚举值。

13. common 统一承载 `ErrorCode` 契约、`BusinessException`、领域异常和领域错误码。每个业务领域只保留一个 `XxxException`，放在 `exception` 包并继承 `BusinessException`；对应的 `XxxErrorCode implements ErrorCode` 统一放在 `enums.<domain>`。禁止在 Service、Controller、Repository 等业务模块重复定义异常或错误码，也禁止为每个错误码单独创建异常类。

## 代码格式

14. 只有参数较多或单行明显过长时才允许换行；换行后必须保持结构紧凑、统一。

15. 简单方法、构造方法、record 声明、方法调用能一行写完就写一行，禁止为了一个参数做无意义换行。

16. 禁止把右括号和左花括号单独悬空，例如禁止：

```java
public Optional<ProjectDetailVO> queryProject(
        @NotNull @Valid QueryProjectDTO dto
) {
```

应写成：

```java
public Optional<ProjectDetailVO> queryProject(@NotNull @Valid QueryProjectDTO dto) {
```
