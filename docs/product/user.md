# User

Status: Done

Capabilities:
- [Authentication](../capabilities/user/authentication.md)
- [User Management](../capabilities/user/user-management.md)

## Contract

V1 用户体系只解决：

```text
你是谁
你能不能登录
你是不是管理员
```

规则：

- 登录标识是 username。
- username 全局唯一且大小写不敏感。
- 角色只有 ADMIN / USER。
- 状态只有 ACTIVE / DISABLED。
- DISABLED 用户不能继续使用系统。
- 用户不物理删除。
- 用户名创建后不能修改。
- 密码修改 / 重置后旧登录状态失效。
- 系统必须始终保留至少一个 ACTIVE ADMIN。
- 首次部署可以初始化第一个 ADMIN。
- 不开放公共注册。

## Boundary

V1 不包含：

- Workspace / Tenant / Team / Organization。
- RBAC / 自定义 Role / Permission。
- OAuth / SSO / LDAP / MFA。
- 邮件邀请 / 找回密码。
