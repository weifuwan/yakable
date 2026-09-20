# yakable-common 开发规范

`yakable-common` 只放跨模块复用的公共对象、工具类、常量、枚举和异常。

## 目录结构

```text
io.yakable.common
├── bean
│   ├── PageData
│   ├── dto
│   │   ├── AddProjectDTO
│   │   ├── QueryProjectDTO
│   │   └── PageDTO
│   └── vo
│       ├── ProjectListVO
│       └── ProjectDetailVO
├── utils
│   ├── ConverUtils
│   ├── DateUtils
│   ├── IdUtils
│   └── ThreadUtils
├── constant
│   └── SystemConstant
├── enums
│   ├── ProjectStatusEnum
│   ├── SessionStatusEnum
│   ├── TurnStatusEnum
│   └── MessageRoleEnum
└── exception
    └── BusinessException
```

## bean

公共数据对象统一放在 `bean` 下。

- `PageData<T>`：统一分页返回结构，包含列表数据和分页信息。

### dto

- `AddProjectDTO`：新增 Project 的输入参数。
- `QueryProjectDTO`：查询单个 Project 的输入参数。
- `PageDTO`：通用分页参数，只有分页条件时直接使用；有额外查询条件时由业务 DTO 继承。

### vo

- `ProjectListVO`：Project 列表页面返回对象。
- `ProjectDetailVO`：Project 详情页面返回对象。

## utils

公共工具类统一放在 `utils` 下。

- `ConverUtils`：对象类型转换，统一处理 `source -> Target.class`。
- `DateUtils`：时间处理，统一处理 `LocalDateTime` 的获取、格式化、解析和转换。
- `IdUtils`：统一生成雪花 ID。
- `ThreadUtils`：统一创建和管理线程、线程池、调度线程池。

线程相关能力统一走 `ThreadUtils`。业务模块禁止直接使用 `new Thread`、`Executors`、`ThreadFactory`、`Thread.ofVirtual()`、`Thread.ofPlatform()` 创建线程或线程池；需要新的线程模型时先在 `ThreadUtils` 中增加统一方法，再由业务代码调用。

## constant

公共常量统一放在 `constant` 下。

- `SystemConstant`：系统级公共常量。

## enums

公共枚举统一放在 `enums` 下。需要持久化的枚举使用 MyBatis-Plus `@EnumValue` 标记数据库数字值，业务代码直接使用枚举本身。

- `ProjectStatusEnum`：Project 状态。
- `SessionStatusEnum`：Session 状态。
- `TurnStatusEnum`：Turn 状态。
- `MessageRoleEnum`：Message 角色。

## exception

公共异常统一放在 `exception` 下。

- `BusinessException`：统一业务异常，Service 中可预期的业务错误统一使用该异常。

## 代码格式

只有参数较多或单行明显过长时才允许换行；换行后必须保持结构紧凑、统一。

简单方法、构造方法、record 声明、方法调用能一行写完就写一行，禁止为了一个参数做无意义换行。

禁止把右括号和左花括号单独悬空，例如：

```java
public Optional<ProjectDetailVO> queryProject(
        @NotNull @Valid QueryProjectDTO dto
) {
```

应写成：

```java
public Optional<ProjectDetailVO> queryProject(@NotNull @Valid QueryProjectDTO dto) {
```
