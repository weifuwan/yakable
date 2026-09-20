# yakable-common 开发规范

`yakable-common` 只放跨模块复用的公共对象、工具类、常量、枚举和异常。

## 目录结构

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

## bean

公共数据对象统一放在 `bean` 下。

### dto

- `AddProjectDTO`：新增 Project 的输入参数。
- `QueryProjectDTO`：查询单个 Project 的输入参数。
- `PageDTO`：通用分页参数，只有分页条件时直接使用；有额外查询条件时由业务 DTO 继承。

### vo

- `ProjectListVO`：Project 列表页面返回对象。
- `ProjectDetailVO`：Project 详情页面返回对象。

### 其它公共 Bean

- `PageData<T>`：统一分页返回结构，包含列表数据和分页信息。

## utils

公共工具类统一放在 `utils` 下。

- `ConverUtils`：对象类型转换，统一处理 `source -> Target.class`。
- `DateUtils`：时间处理，统一处理 `LocalDateTime` 的获取、格式化、解析和转换。

## constant

公共常量统一放在 `constant` 下。

当前暂无公共常量类。

## enums

公共枚举统一放在 `enums` 下。

当前暂无公共枚举类。

## exception

公共异常统一放在 `exception` 下。

- `BusinessException`：统一业务异常，Service 中可预期的业务错误统一使用该异常。
