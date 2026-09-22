# User Domain

Product:
- [User](../../product/user.md)

## Graph

```text
Authentication
      ↓
Current User
      ↓
User Management
```

Capabilities:

- [Authentication](./authentication.md)
- [User Management](./user-management.md)

## Shared Rules

### USER-001 — Username Identity

username 全局唯一，唯一性大小写不敏感；创建后不可修改。

### USER-002 — Status

用户状态只有 ACTIVE / DISABLED；DISABLED 不能继续使用系统。

### USER-003 — Role

角色只有 ADMIN / USER。

### USER-004 — Session Revocation

禁用用户、修改密码或管理员重置密码后，相关旧登录状态必须失效。

### USER-005 — Last Admin

系统必须始终保留至少一个 ACTIVE ADMIN；最后一个 ACTIVE ADMIN 不能被禁用或降级。

### USER-006 — No Physical Delete

V1 不物理删除 User。

## Cross-Capability Scenarios

### USER-S01 — Login

Involves:
- Authentication

Guarantees:
- 用户名或密码错误不区分具体原因。
- ACTIVE 用户成功建立登录状态。
- DISABLED 用户不能建立登录状态。

### USER-S02 — Disable User

Involves:
- User Management
- Authentication

Guarantees:
- User 变为 DISABLED。
- 现有登录状态立即失效。
- 历史业务数据保留。

### USER-S03 — Password Change / Reset

Involves:
- User Management
- Authentication

Guarantees:
- 密码更新成功。
- 原登录状态全部失效。
