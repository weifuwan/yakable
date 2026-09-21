# Yakable 后端测试规范

本规范适用于 Yakable Spring Boot 后端。

测试用于保护稳定的业务行为、接口契约和数据规则，不以覆盖率或测试数量为目标。

## 1. 什么时候写测试

以下情况应增加或更新测试：

- Service 存在明确的业务规则、状态变化或异常分支。
- Controller 的请求、响应、错误码等接口契约发生变化。
- Repository / Mapper 存在自定义 SQL、查询、更新、事务或 Mapper XML。
- LLM、Streaming、Context 等核心行为发生变化。
- 修复了需要防止再次出现的 Bug。

以下情况默认不写测试：

- DTO、VO、Entity、简单枚举和常量。
- Lombok 自动生成的代码。
- 无业务逻辑的简单 CRUD 和透传方法。
- Spring、MyBatis-Plus 等框架已经保证的基础行为。
- private 方法和内部实现细节。

如果一个测试失败后无法说明哪个业务行为被破坏，通常不应该增加这个测试。

## 2. Unit Test

Unit Test 用于验证一个类自己负责的行为。

要求：

- 不启动完整 Spring Boot。
- 不连接真实数据库。
- 不访问真实网络。
- 不调用真实 LLM。
- 只 Mock 测试边界之外的依赖。

Service 优先使用 JUnit + Mockito。

例如：

```text
SessionService
    ↓ Mock
Repository / LlmClient / 其他 Service
```

测试返回结果、业务异常、状态变化和必要的外部协作，不测试内部实现步骤。

## 3. Integration Test

只有真实组件协作本身需要验证时才写 Integration Test。

适用于：

- Repository / Mapper 自定义数据库行为。
- Mapper XML。
- Flyway Migration。
- 数据库约束。
- 真实事务提交和回滚。
- 必须验证的 Spring 配置或组件集成。

数据库测试统一使用 Testcontainers + MySQL。

禁止使用 H2 模拟 MySQL 特有行为。

能用 Unit Test 证明的行为，不升级成 Integration Test。

## 4. 各层测试边界

### Service

测试业务行为。

Mock Repository、LLM 和外部依赖，不启动 Spring Boot。

### Controller

只测试 HTTP Contract，包括：

- 请求参数和校验。
- HTTP Status。
- `Result<T>` 响应结构。
- 错误码和异常映射。
- SSE / Streaming 对外协议。

优先使用 `@WebMvcTest` + `MockMvc`，并 Mock Service。

Controller Test 不重复测试 Service 业务逻辑。

### DAO

只测试自定义持久化行为。

MyBatis-Plus 提供的普通 CRUD 不重复测试。

Repository / Mapper Integration Test 使用真实 MySQL，不 Mock Mapper 和数据库。

### Model Plugin

测试稳定协议，包括：

- 请求转换。
- 响应解析。
- Streaming Event 转换。
- Provider 错误转换。
- Model metadata 和 context window 等确定性规则。

禁止调用真实 DeepSeek、Kimi、OpenAI 或其他第三方模型服务。

## 5. Mock 规范

**Mock 测试边界之外的依赖，不 Mock 被测试行为本身。**

推荐：

```text
Service → Mock Repository
```

禁止：

```text
Service
→ Mock Repository
→ Mock Mapper
→ Mock MyBatis 内部对象
```

只有某次协作本身属于业务契约时，才验证调用次数或调用参数。

不要为了覆盖实现细节，对所有内部调用都做 `verify`。

## 6. 测试稳定性

测试必须可重复、可独立执行。

禁止：

- 使用 `Thread.sleep()` 等待结果。
- 依赖测试执行顺序。
- 依赖生产环境数据。
- 调用真实第三方服务。
- 使用真实账号或密钥。
- 使用随机结果决定测试是否通过。

测试数据优先使用固定 ID、固定时间和明确的业务值。

数据库 Integration Test 必须保持数据隔离。

## 7. 测试位置与命名

测试放在所属 Maven Module 的 `src/test/java` 下，并与生产代码保持相同包结构。

例如：

```text
yakable-service/
├── src/main/java/io/yakable/service/session/...
└── src/test/java/io/yakable/service/session/...
```

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
```

测试资源放在对应 Module 的 `src/test/resources`。

禁止把所有后端测试统一堆到独立的全局 `tests/` 目录。

## 8. Spring Boot 使用边界

`@SpringBootTest` 不是默认测试方式。

优先级：

```text
JUnit + Mockito
    ↓
Spring Test Slice
    ↓
Integration Test
    ↓
@SpringBootTest
```

Controller 优先 `@WebMvcTest`。

Service 优先纯 JUnit + Mockito。

DAO 优先 Testcontainers + MySQL。

只有必须验证完整 Spring 应用装配时才使用 `@SpringBootTest`。

不要用一个 `@SpringBootTest` 同时重复测试 Controller、Service、Repository 三层。

## 9. 测试执行

Unit Test 和 Integration Test 必须能够独立执行。

约定：

```text
maven test
→ 只运行快速 Unit Test（*Test.java）

maven verify / integration profile
→ 运行 Integration Test（*IT.java）
```

普通 Unit Test 不得默认启动 Docker、MySQL 或其他外部服务。

## 原则

**测试业务行为，不测试实现细节。**

**Service 测业务，Controller 测接口契约，DAO 测真实持久化。**

**能用 Unit Test 解决，就不要升级成 Integration Test。**

**能不启动 Spring Boot，就不要使用 `@SpringBootTest`。**

**真实 LLM 和真实第三方 API 不进入自动化测试。**
