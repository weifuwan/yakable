# User Management

## 能力

管理员维护系统用户，用户维护自己的资料和密码。

## 用户行为

ADMIN：

- 查看 / 搜索 / 筛选用户。
- 创建用户。
- 编辑用户。
- 启用 / 禁用。
- 重置密码。

USER：

- 查看当前账号。
- 修改基础资料。
- 修改自己的密码。

## 边界

角色只有：

```text
ADMIN
USER
```

状态只有：

```text
ACTIVE
DISABLED
```

用户名创建后不可修改。

不物理删除 User。

V1 不引入 Role / Permission / Team / Tenant。

## 流程

```text
UsersTable / UserFormDialog
→ frontend UserService
→ UserController
→ UserService
→ UserRepository
→ UserMapper / UserEntity
```

密码和状态变更需要使相关已有登录状态失效。

## 代码

Frontend：

```text
yakable-ui/src/features/user-management/
yakable-ui/src/pages/users/
yakable-ui/src/pages/profile/
yakable-ui/src/service/user/
```

Backend：

```text
UserController.java
UserService.java / UserServiceImpl.java
UserRepository.java
AuthSessionRepository.java
```

## 测试

保护：

- username 唯一。
- ADMIN / USER 权限。
- 不能禁用或降级最后一个 ACTIVE ADMIN。
- DISABLED 不能登录。
- 修改 / 重置密码后旧登录失效。
