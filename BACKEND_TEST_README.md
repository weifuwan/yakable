# Yakable 后端测试规范

本规范适用于 Yakable Spring Boot 后端，包括 `yakable-common`、`yakable-core`、`yakable-dao`、`yakable-service`、`yakable-boot` 和 Model Plugin。

测试的目标是保护稳定的业务行为、接口契约、数据规则和关键集成边界，并让后续重构更安全。

测试不是为了给每个类、每个方法补覆盖率，也不是为了验证代码内部“怎么实现”。

## 1. 什么时候应该写测试

以下场景应优先补充或更新测试：

- Service 中存在明确的业务规则、状态变化、异常分支或跨领域协作。
- Controller 的请求参数、响应结构、HTTP 状态、错误码等接口契约发生变化。
- Repository / Mapper 中存在自定义查询、更新、分页、排序、事务或 Mapper XML。
- Session、Turn、Message 等核心状态流转发生变化。
- LLM 请求构造、流式响应、错误转换、取消生成等关键流程发生变化。
- Flyway Migration、唯一约束、数据库约束或持久化规则发生变化。
- 修复了一个值得长期防止回归的 Bug。
- 一个方法具有明确、稳定的输入输出，并且错误会影响真实业务。

新增代码时先判断风险，再决定是否增加测试。测试数量不是目标，能保护真实行为才是目标。

## 2. 什么时候不应该写测试

不要为了类数量、方法数量、覆盖率或“看起来完整”机械增加测试。

以下内容默认不需要单独测试：

- DTO、VO、Entity 的 Getter / Setter。
- Lombok 自动生成的代码。
- 只声明字段、枚举值或常量且没有业务规则的类型。
- 没有自定义行为的简单 Mapper。
- 单纯调用 Repository 后直接返回的透传方法。
- Spring、MyBatis-Plus、Lombok 等框架已经保证的基础行为。
- private 方法、局部变量、内部实现步骤。
- 仅验证“Spring 能启动”“Bean 能创建”的低价值测试。
- 仅为了提高覆盖率而构造的不可达分支。

如果一个测试失败后无法说明“用户、接口或业务会遇到什么问题”，通常不应该增加这个测试。

## 3. 测试分层

Yakable 后端测试只分两大类：

### Unit Test

Unit Test 用于验证一个类自己负责的业务行为。

默认要求：

- 不启动完整 Spring Boot。
- 不连接真实数据库。
- 不访问真实网络。
- 不调用真实 LLM。
- Mock 当前测试边界之外的依赖。
- 执行速度要快，适合开发阶段频繁运行。

典型场景：

```text
ProjectService
    ↓ Mock
ProjectRepository
```

```text
SessionService
    ↓ Mock
SessionRepository / TurnService / LlmClient
```

```text
Model Plugin Adapter
    ↓ Mock
Provider HTTP Client
```

Unit Test 关注：

- 输入什么。
- 返回什么。
- 状态如何变化。
- 什么情况下抛出什么业务异常。
- 是否产生了必要的外部协作结果。

不要测试 if 写了几层、private 方法调用了几次、内部对象如何组装等实现细节。

### Integration Test

Integration Test 用于验证多个真实组件协同工作时的行为。

只有 Unit Test 无法证明目标行为时才升级为 Integration Test。

典型场景：

- Repository + Mapper + MyBatis-Plus + MySQL。
- Flyway Migration + MySQL。
- 真实事务提交与回滚。
- 数据库唯一约束、索引或 SQL 方言。
- Controller + Spring MVC + 真实序列化 / Validation / ExceptionHandler 的组合契约。
- 需要验证真实 Spring 配置装配的少量关键场景。

Integration Test 可以启动必要的 Spring Context 和 Testcontainers，但只启动证明目标行为所需要的最小范围。

不要因为测试一个普通 Service 就默认使用 `@SpringBootTest`。

## 4. Service 测试规范

`yakable-service` 是后端 Unit Test 的重点。

Service Test 使用公开方法验证业务行为，外部依赖通过接口 Mock。

例如：

```text
SessionServiceImpl
    ↓
Mock SessionRepository
Mock TurnService
Mock MessageService
Mock LlmClient
```

Service Test 应重点覆盖：

- 正常成功路径。
- 关键业务失败路径。
- 状态转换。
- 业务异常和错误码。
- 必须发生的领域协作。
- Bug 回归场景。

对于 Session / Turn / Message，优先保护类似行为：

```text
创建 Turn
PENDING → RUNNING → SUCCEEDED
```

```text
LLM 调用失败
→ Turn FAILED
→ 错误信息正确保留
```

```text
用户取消生成
→ Turn CANCELLED
→ 已生成内容按业务规则保留
```

```text
生成完成
→ User / Assistant Message 顺序正确
```

Service Test 不启动完整 Spring Context。能够直接实例化实现类并注入 Mock 时，就不要使用 `@SpringBootTest`。

Service Test 不重复验证 Repository 的 SQL 是否正确；Repository 的真实持久化行为交给 Integration Test。

## 5. Controller 测试规范

`yakable-boot` 的 Controller Test 只保护 HTTP Contract。

优先使用 Spring MVC 的测试切片，例如 `@WebMvcTest` + `MockMvc`，并 Mock Service。

Controller Test 重点验证：

- URL 和 HTTP Method。
- PathVariable / RequestParam / RequestBody 的绑定。
- Jakarta Validation。
- HTTP Status。
- `Result<T>` 响应结构。
- DTO 是否正确传入 Service。
- BusinessException 是否经过 `GlobalExceptionHandler` 转换成稳定错误响应。
- SSE / Streaming 接口的 Content-Type 和对外事件契约。

例如：

```text
POST /api/projects

缺少必填字段
→ 参数校验失败

合法请求
→ Service 被调用
→ 返回稳定 Result<ProjectDetailVO>

Service 抛 ProjectException
→ GlobalExceptionHandler 转换
→ 返回对应业务错误码
```

Controller Test 不重新测试 Service 的业务规则，也不验证数据最终如何写入数据库。

如果一个 Controller 只是非常薄的 Service 转发，并且没有参数校验、异常映射或特殊协议契约，可以不为每个方法机械补测试。

## 6. DAO 测试规范

`yakable-dao` 只有真实数据访问行为需要测试。

以下场景优先写 Integration Test：

- 自定义 Repository 方法。
- 自定义 Mapper SQL。
- Mapper XML。
- 多条件查询。
- 分页和排序。
- Update Wrapper 或复杂更新逻辑。
- 唯一约束和数据库约束。
- 事务相关行为。
- Flyway Migration。

基础 CRUD 如果完全由 MyBatis-Plus 提供，不重复测试框架本身。

DAO Integration Test 使用 Testcontainers 启动真实 MySQL。

禁止使用 H2 去模拟 MySQL 特有行为。原因是 SQL 方言、索引、约束、JSON、时间、字符集等行为可能与 MySQL 不一致。

Repository / Mapper Integration Test 不 Mock Mapper，也不 Mock 数据库。

## 7. Flyway 测试规范

Flyway Migration 属于数据库契约。

出现以下情况时应增加或更新 Integration Test：

- 新建表。
- 修改字段。
- 新增唯一约束或索引。
- 数据迁移。
- 不可逆或兼容性风险较高的 Migration。

测试重点是：

- 空数据库可以从头迁移成功。
- 目标表、字段、索引、约束存在。
- 关键历史数据可以按预期迁移。
- Migration 重复执行不会造成异常行为。

不要仅通过“SQL 文件存在”判断 Migration 正确。

## 8. LLM 和 Model Plugin 测试规范

自动化测试禁止调用真实模型服务，包括但不限于：

- DeepSeek。
- Kimi。
- OpenAI。
- 其他真实第三方 LLM API。

Service Test 中的 `LlmClient` 必须使用 Mock 或 Fake。

Model Plugin / Provider Adapter Test 重点验证：

- 请求参数构造。
- Model 名称和配置映射。
- Provider 响应解析。
- Token Usage 转换。
- Streaming Event 转换。
- Provider 错误转换。
- Timeout、Cancel、网络异常的映射。
- Provider metadata / context window 等稳定协议。

Provider Adapter Test 可以 Mock HTTP Client 或使用本地 Fake Server，但不得访问真实生产端点，也不得依赖真实 API Key。

模型输出内容本身不可预测，不应把“LLM 必须回答某句话”作为自动化测试契约。

## 9. Core 测试规范

`yakable-core` 负责稳定运行时协议和确定性逻辑。

以下内容适合 Unit Test：

- LLM Request / Response 的稳定转换规则。
- Token 预算计算。
- Context 裁剪。
- 完整 Turn 保留规则。
- Provider metadata 的确定性选择规则。
- 不依赖外部环境的 Harness / Runtime 规则。

Core Test 不 Mock 自己正在验证的算法。

如果逻辑是纯函数，直接使用输入和输出验证，不启动 Spring。

## 10. Common 测试规范

`yakable-common` 只为真正存在逻辑的公共能力写测试。

适合测试：

- String / Date / JSON 等工具中有业务约束的转换。
- ID 或时间处理中的稳定规则。
- Result / ErrorCode 中存在明确映射逻辑的行为。

通常不测试：

- DTO / VO。
- 简单枚举。
- 常量。
- Lombok Bean。
- 无逻辑的类型声明。

公共工具测试只验证公开输入输出，不测试内部实现步骤。

## 11. Mock 规范

原则只有一句：

**Mock 测试边界之外的依赖，不 Mock 被测试行为的拥有者。**

例如测试 `SessionServiceImpl` 时，可以 Mock：

- SessionRepository。
- TurnService。
- MessageService。
- LlmClient。

但不要把 `SessionServiceImpl` 自己的业务判断 Mock 掉。

Mock 应尽量停在稳定接口边界，不要深度 Mock 一串内部对象。

优先：

```text
Service → Mock Repository interface
```

不要：

```text
Service
→ Mock Repository
→ Mock Mapper
→ Mock Wrapper
→ Mock MyBatis internal object
```

只有“某次协作是否发生”本身属于业务契约时，才验证调用次数或调用参数。

不要为了覆盖实现细节，对每个内部方法调用都做 `verify`。

## 12. 数据库和事务

Unit Test 不依赖真实数据库。

数据库行为统一进入 Integration Test，并使用 Testcontainers + MySQL。

事务只有在事务本身属于业务契约时才测试，例如：

```text
创建 Session 成功
→ Session / Turn / Message 一起提交
```

```text
中间步骤失败
→ 相关数据全部回滚
```

这种行为不能通过 Mock Repository 证明，应使用 Integration Test 验证真实事务。

每个 Integration Test 必须保持数据隔离，不依赖其他测试提前插入的数据。

## 13. 时间、异步和并发

测试必须可重复、可预测。

禁止：

- 依赖真实当前时间做精确断言。
- 使用随机值决定测试是否通过。
- 使用 `Thread.sleep()` 等待异步结果。
- 依赖测试执行顺序。
- 在测试结束后遗留线程、连接或未提交事务。

时间属于业务规则时，优先把 Clock / 时间来源作为可替换边界。

异步和并发测试优先使用明确的同步机制，例如：

- CompletableFuture。
- CountDownLatch。
- Awaitility（如果后续项目统一引入）。

所有等待都必须有明确超时，避免测试无限挂起。

## 14. 测试数据

测试数据应尽量简单、明确、稳定。

- 使用固定 ID、固定时间和固定业务值。
- 只构造当前 Case 需要的数据。
- 不依赖生产环境数据。
- 不使用真实账号、真实密钥和真实外部资源。
- 重复测试数据明显增多后，再抽 Test Builder / Fixture。

不要一开始就建立复杂 Test Factory 体系。

Test Builder 应提供合法默认值，每个 Case 只覆盖与当前行为相关的字段。

## 15. 断言规范

断言应该验证公开结果，而不是内部实现。

优先断言：

- 返回值。
- 业务异常类型和错误码。
- 对外 VO / Result。
- 状态变化。
- 持久化后的真实数据。
- 必要的外部协作结果。

避免断言：

- private 方法。
- 内部变量。
- 无业务意义的调用顺序。
- 框架内部对象。
- 为了凑覆盖率产生的中间状态。

一个测试尽量只描述一个行为。一个行为可以包含多个共同证明结果的断言。

## 16. Coverage

Coverage 是诊断信号，不是质量目标。

Yakable 不要求为了达到某个覆盖率百分比而机械补测试。

可以使用 Coverage 找到可疑空白，但是否需要补测试仍然由业务风险决定。

高覆盖率不能代替高价值测试。

## 17. 测试文件位置

测试必须放在所属 Maven Module 的 `src/test/java` 下，并镜像生产代码包结构。

### Service

```text
yakable-service/
├── src/main/java/io/yakable/service/session/...
└── src/test/java/io/yakable/service/session/...
```

### DAO

```text
yakable-dao/
├── src/main/java/io/yakable/dao/repository/...
└── src/test/java/io/yakable/dao/repository/...
```

### Controller

```text
yakable-boot/
├── src/main/java/io/yakable/boot/controller/session/...
└── src/test/java/io/yakable/boot/controller/session/...
```

### Plugin

```text
yakable-plugins/yakable-plugin-model/
├── src/main/java/...
└── src/test/java/...
```

测试资源放在对应 Module 的 `src/test/resources`。

禁止把所有后端测试统一堆到一个与生产代码结构无关的全局 `tests/` 目录。

## 18. 命名规范

Unit Test：

```text
XxxServiceTest.java
XxxControllerTest.java
XxxPolicyTest.java
```

Integration Test：

```text
XxxRepositoryIT.java
XxxMapperIT.java
XxxFlywayIT.java
XxxTransactionIT.java
```

测试方法名直接描述业务行为和预期结果，不使用无意义的 `test1`、`testSuccess`、`testMethod`。

例如：

```text
shouldCancelRunningTurn()
shouldRejectTurnWhenSessionArchived()
shouldRollbackMessagesWhenTurnCreationFails()
```

命名的重点是让失败日志能够直接说明哪个业务行为被破坏。

## 19. Spring Boot 使用边界

`@SpringBootTest` 不是默认测试方式。

优先级：

```text
纯 Java Unit Test
    ↓
Spring Test Slice
    ↓
Integration Test
    ↓
完整 @SpringBootTest
```

只有整个应用装配、本地事务边界、Spring 配置或跨多个真实 Bean 的组合行为本身就是测试目标时，才使用完整 `@SpringBootTest`。

Controller 优先 `@WebMvcTest`。

Service 优先纯 JUnit + Mockito。

DAO 优先真实 MySQL Integration Test。

不要用一个 `@SpringBootTest` 同时重复测试 Controller、Service、Repository 三层。

## 20. 测试执行

后端测试最终应保持 Unit Test 和 Integration Test 可独立执行。

目标约定：

```text
*maven test*
→ 只运行快速 Unit Test（*Test.java）

*maven verify / integration profile*
→ 运行 Integration Test（*IT.java）
```

当前仓库尚未正式接入后端测试依赖和 Integration Test Profile；引入时必须保持上述边界，不要让普通 Unit Test 默认启动 Docker、MySQL 或其他外部服务。

## 21. 代码评审检查

新增或修改后端测试时，至少确认：

- 这个测试保护的是业务行为还是实现细节。
- 是否选择了最小测试边界。
- Unit Test 是否错误启动了 Spring Boot。
- Service Test 是否错误连接了真实数据库或真实网络。
- Integration Test 是否真的需要真实基础设施。
- Controller Test 是否重复测试了 Service 逻辑。
- DAO Test 是否在测试 MyBatis-Plus 已经保证的基础 CRUD。
- 是否调用了真实 LLM 或第三方 API。
- 是否使用了 `Thread.sleep()`、随机值或测试顺序。
- 测试失败时，能否直接说明哪个业务契约被破坏。

## 原则

**测试业务行为，不测试实现细节。**

**Service 测业务行为，Repository 测真实持久化，Controller 测接口契约。**

**能用 Unit Test 证明，就不要升级成 Integration Test。**

**能不启动 Spring Boot，就不要使用 `@SpringBootTest`。**

**真实 LLM、真实第三方 API 不进入自动化测试。**
