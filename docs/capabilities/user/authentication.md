# Authentication

Status: Done
Domain: User

Depends On:
- User data

Related:
- [User Management](./user-management.md)

Frontend:
- `yakable-ui/src/features/auth/components/LoginForm.tsx`
- `yakable-ui/src/features/auth/components/UserMenu.tsx`
- `yakable-ui/src/service/auth/AuthService.ts`
- `yakable-ui/src/pages/login/index.tsx`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/auth/AuthController.java`
- `yakable-service/src/main/java/io/yakable/service/auth/AuthService.java`
- `yakable-service/src/main/java/io/yakable/service/auth/impl/AuthServiceImpl.java`
- `yakable-service/src/main/java/io/yakable/service/user/UserService.java`

Data:
- User
- Auth Session

Shared Rules:
- USER-001
- USER-002
- USER-003
- USER-004

Scenarios:
- USER-S01
- USER-S02
- USER-S03

Tests:
- `yakable-ui/src/__tests__/AuthFlow.test.tsx`
- `yakable-ui/src/service/auth/__tests__/AuthService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/auth/AuthControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/auth/impl/AuthServiceImplTest.java`
- `yakable-service/src/test/java/io/yakable/service/auth/impl/AuthSessionServiceImplTest.java`

## Purpose

使用用户名和密码建立登录状态，并让后续请求识别当前用户。

## Contract

- 登录标识只使用 username。
- 用户名或密码错误时不区分具体失败原因。
- DISABLED 用户不能登录或继续使用旧登录状态。
- 登录成功建立 HttpOnly Session Cookie。
- Logout 立即使当前登录状态失效并清除 Cookie。
- 受保护请求通过当前 Session 恢复 CurrentUser。
- 用户被禁用、修改密码或重置密码后，旧 Session 必须失效。

## Flow

```text
LoginForm
→ AuthService.ts
→ POST /api/auth/login
→ AuthController
→ AuthServiceImpl
→ UserService.authenticateUser
→ auth session
→ Set-Cookie
→ CurrentUser
```

## Boundary

Owns:
- login
- logout
- current user session
- auth cookie

Does Not Own:
- user CRUD
- OAuth / SSO / LDAP / MFA
- public registration
