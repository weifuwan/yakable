# Authentication

## 能力

使用用户名和密码登录 Yakable，并让后续请求能够识别当前用户。

## 用户行为

```text
username + password
→ login
→ session cookie
→ enter Yakable

logout
→ session invalid
→ cookie cleared
```

未登录访问受保护页面时进入登录流程。

## 边界

V1：

- 用户名 + 密码。
- HttpOnly Session Cookie。
- logout。
- current user。

不包含 OAuth、SSO、LDAP、MFA 和公开注册。

## 流程

```text
LoginForm
→ AuthService.login()
→ POST /api/auth/login
→ AuthController
→ AuthService
→ UserService.authenticateUser()
→ auth session
→ Set-Cookie
```

后续：

```text
cookie
→ security filter
→ CurrentUserVO
→ Controller
```

## 代码

Frontend：

```text
yakable-ui/src/features/auth/components/LoginForm.tsx
yakable-ui/src/service/auth/AuthService.ts
yakable-ui/src/pages/login/
```

Backend：

```text
AuthController.java
AuthService.java / AuthServiceImpl.java
UserService.java
AuthSessionRepository.java
```

## 测试

保护登录成功/失败、logout、current user、禁用用户无法继续使用和 Cookie 语义。

## 依赖

依赖 User 数据。

Project、Session 等业务能力都依赖当前用户身份。
