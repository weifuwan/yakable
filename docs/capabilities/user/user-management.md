# User Management

Status: Done
Domain: User

Depends On:
- [Authentication](./authentication.md)

Related:
- None

Frontend:
- `yakable-ui/src/features/user-management/components/UsersTable.tsx`
- `yakable-ui/src/features/user-management/components/UserFormDialog.tsx`
- `yakable-ui/src/features/user-management/components/ResetPasswordDialog.tsx`
- `yakable-ui/src/pages/users/index.tsx`
- `yakable-ui/src/pages/profile/index.tsx`
- `yakable-ui/src/service/user/UserService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/user/UserController.java`
- `yakable-service/src/main/java/io/yakable/service/user/UserService.java`
- `yakable-service/src/main/java/io/yakable/service/user/impl/UserServiceImpl.java`

Data:
- User
- Auth Session

Shared Rules:
- USER-001
- USER-002
- USER-003
- USER-004
- USER-005
- USER-006

Scenarios:
- USER-S02
- USER-S03

Tests:
- `yakable-ui/src/features/user-management/components/__tests__/UsersTable.test.tsx`
- `yakable-ui/src/features/user-management/components/__tests__/UserFormDialog.test.tsx`
- `yakable-ui/src/service/user/__tests__/UserService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/user/UserControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/user/impl/UserServiceImplTest.java`

## Purpose

管理员维护系统用户，用户维护自己的资料和密码。

## Contract

- ADMIN 可以查看、创建、编辑、启用、禁用和重置其他用户密码。
- USER 只能维护自己的基础资料和密码。
- username 创建后不可修改。
- 用户不物理删除。
- 最后一个 ACTIVE ADMIN 不能被禁用或降级。
- DISABLED 用户历史数据保留。
- 密码修改 / 重置后旧登录状态失效。
- 首次部署且无用户时允许初始化第一个 ADMIN。

## Flow

```text
UsersTable / UserFormDialog / Profile
→ UserService.ts
→ UserController
→ UserServiceImpl
→ UserRepository
→ UserEntity

status / password change
→ revoke related auth sessions
```

## Boundary

Owns:
- user CRUD without physical delete
- role / status management
- profile update
- password change / reset
- first admin initialization

Does Not Own:
- login session creation
- RBAC / team / tenant
- external identity provider
