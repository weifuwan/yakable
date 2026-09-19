# yakable-service 开发规范

`yakable-service` 只负责业务逻辑。

固定调用链：

```text
Controller
    ↓
Service
    ↓
Repository
```

## 规范

1. Project 业务统一进入 `ProjectService`，Session / Turn / Message 业务统一进入 `SessionService`。

2. 不拆 `CommandService`、`QueryService`、`Manager`、`UseCase` 等同领域重复角色。

3. Service 直接调用 `yakable-dao` 的 Repository，不增加 Repository 接口、Port、Gateway、Adapter。

4. 不创建 `application`、`domain`、`infrastructure` 等分层目录。

5. 事务直接使用 Spring 事务能力，不自定义 `TransactionRunner` 等事务抽象。

6. 只在真正独立的技术能力上拆辅助包；当前模型调用放 `model`，Turn 执行放 `turn`。

7. 只被一个 Service 使用的请求、结果、状态对象优先放在 Service 内，不为简单数据结构单独建文件。

8. Controller 只调用 Service，不直接调用 Repository、Mapper、Entity。

9. Service 不直接调用 Mapper，数据库访问统一经过 Repository。

10. 新增 Service 前先判断能否放进现有 `ProjectService` 或 `SessionService`。

## 核心原则

**一个领域优先一个 Service。**

**能直接表达，就不要再抽一层。**

**复杂度出现以后再拆，不提前设计。**
