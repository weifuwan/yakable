# Yakable 用户管理 PRD V1

> 状态：Draft  
> 版本：V1  
> 范围：系统用户管理  
> 原则：只解决当前真实需求，不提前引入 Workspace、Tenant、RBAC 等复杂能力。

## 1. 背景

Yakable 当前已经具备 Project、Session、Turn、Message 等基础业务能力，但还缺少正式的用户体系。

现阶段只需要先回答一个最基础的问题：

> 谁在使用 Yakable？

因此 V1 先建立一套简单、稳定、可扩展的用户管理机制，完成登录、身份识别和基础用户管理闭环。

当前不引入 Workspace、Tenant、Team、Organization、Membership、复杂 RBAC 等能力。

## 2. 产品目标

用户管理 V1 解决四件事情：

- 用户可以登录 Yakable。
- 系统可以识别当前登录用户。
- 管理员可以管理系统用户。
- 用户数据可以与后续业务数据建立关联。

最小闭环：

```text
创建用户
   ↓
用户登录
   ↓
识别当前用户
   ↓
使用 Yakable
   ↓
管理员管理用户
```

## 3. 本期范围

### 3.1 本期包含

- 用户登录
- 用户退出登录
- 获取当前用户
- 用户列表
- 创建用户
- 编辑用户
- 启用 / 禁用用户
- 修改自己的密码
- 管理员重置用户密码
- 用户基本信息维护

### 3.2 本期不包含

- 用户注册
- 邮件邀请
- Workspace
- Tenant
- Team
- Organization
- Membership
- 多租户
- RBAC
- Permission
- 自定义角色
- OAuth
- GitHub 登录
- Google 登录
- SSO
- LDAP
- MFA
- EndUser
- 用户组
- 部门管理

以上能力等真正出现业务需求后再增加。

## 4. 用户模型

系统当前只存在一种用户：

```text
User
```

User 代表可以登录 Yakable 的真实账号。

基础模型：

```text
User
├── id
├── username
├── name
├── email
├── password
├── avatar
├── role
├── status
├── last_login_at
├── created_at
└── updated_at
```

### 4.1 id

用户唯一标识。

- 系统生成
- 不允许修改

### 4.2 username

登录账号。

要求：

- 必填
- 全局唯一
- 创建后默认不允许修改

示例：

```text
weifuwan
```

### 4.3 name

用户展示名称。

允许修改。

### 4.4 email

用户邮箱。

V1 只作为用户基础信息保存，暂时不承担：

- 邮箱登录
- 找回密码
- 邮件验证
- 邮件邀请

### 4.5 password

用户登录密码。

数据库禁止保存明文密码，只保存安全的密码 Hash。

## 5. 用户角色

V1 只保留两个固定角色：

```text
ADMIN
USER
```

### 5.1 ADMIN

系统管理员，可以：

- 查看用户列表
- 创建用户
- 编辑用户
- 启用用户
- 禁用用户
- 重置用户密码

### 5.2 USER

普通 Yakable 用户，可以：

- 登录系统
- 使用 Yakable
- 查看自己的信息
- 修改自己的密码

V1 不设计独立的：

```text
Role
Permission
RolePermission
UserRole
```

当前直接使用：

```text
user.role
```

满足需求即可。

## 6. 用户状态

用户状态只保留：

```text
ACTIVE
DISABLED
```

### 6.1 ACTIVE

正常用户，可以登录 Yakable。

### 6.2 DISABLED

已禁用用户。

禁用后：

- 禁止再次登录
- 用户数据继续保留
- 不进行物理删除

## 7. 登录

登录页面提供：

```text
用户名
密码
登录
```

用户输入：

```text
username
password
```

系统校验流程：

```text
用户是否存在
        ↓
用户是否 ACTIVE
        ↓
密码是否正确
        ↓
登录成功
```

登录成功后进入 Yakable。

## 8. 登录失败

账号或密码错误统一提示：

```text
用户名或密码错误
```

账号被禁用：

```text
当前账号已被禁用
```

不要分别返回：

```text
用户不存在
密码错误
```

避免暴露系统中是否存在某个账号。

## 9. 当前用户

登录完成后，前端需要能够获取当前用户：

```http
GET /api/user/me
```

返回：

```text
id
username
name
email
avatar
role
status
```

前端所有需要当前用户信息的地方统一从当前用户状态获取，不在不同页面重复查询和维护用户信息。

## 10. 用户列表

管理员进入：

```text
系统设置
  ↓
用户管理
```

页面展示：

| 字段 | 说明 |
| --- | --- |
| 用户 | 头像 + name |
| 用户名 | username |
| 邮箱 | email |
| 角色 | ADMIN / USER |
| 状态 | ACTIVE / DISABLED |
| 最近登录 | last_login_at |
| 创建时间 | created_at |
| 操作 | 编辑 / 重置密码 / 禁用或启用 |

支持：

- 关键词搜索
- 状态筛选
- 角色筛选
- 分页

关键词支持匹配：

```text
username
name
email
```

## 11. 创建用户

管理员点击“新增用户”，填写：

```text
用户名 *
姓名 *
邮箱
角色 *
初始密码 *
```

默认：

```text
role = USER
status = ACTIVE
```

创建成功后，用户可以直接使用“用户名 + 初始密码”登录。

V1 不发送邮件。

## 12. 编辑用户

管理员可以修改：

```text
name
email
avatar
role
status
```

默认不允许在编辑用户中修改：

```text
id
username
password
```

密码使用独立操作修改，避免一个编辑接口承担过多职责。

## 13. 禁用用户

管理员可以禁用用户。

禁用后：

```text
status = DISABLED
```

用户数据继续保留。

V1 不提供物理删除用户能力。

原因是 User 后续可能已经和 Project、Session、Message 等业务数据建立关系。

因此：

> 禁用代替删除。

## 14. 管理员保护

系统必须保证至少存在一个可用管理员。

禁止：

```text
最后一个 ADMIN
        ↓
修改成 USER
```

也禁止：

```text
最后一个 ACTIVE ADMIN
        ↓
DISABLED
```

同时，管理员不能禁用自己，避免误操作导致当前账号被锁定。

## 15. 修改自己的密码

用户可以进入：

```text
个人设置
  ↓
修改密码
```

需要输入：

```text
当前密码
新密码
确认新密码
```

校验当前密码正确后才能修改。

## 16. 管理员重置密码

管理员可以为用户执行“重置密码”。

输入：

```text
新密码
确认密码
```

管理员不需要知道用户旧密码。

修改完成后提示：

```text
密码已重置
```

V1 不做邮件通知。

## 17. 首个管理员

系统第一次部署时，需要解决第一个管理员从哪里来的问题。

V1 通过系统初始化创建管理员。

例如使用环境变量：

```text
YAKABLE_ADMIN_USERNAME
YAKABLE_ADMIN_PASSWORD
```

应用启动时：

```text
如果系统没有任何 User
        ↓
创建初始化 ADMIN
```

系统已经存在用户时，不得再次创建初始化管理员。

V1 不提供公开的：

```text
/register
```

注册入口。

## 18. 用户与业务数据

用户体系建立后，新创建的核心业务数据需要逐步关联用户。

例如：

```text
Project
├── id
├── name
└── created_by
```

```text
Session
├── id
├── project_id
└── created_by
```

V1 不要求立刻改造所有历史表。

后续按照业务需要逐步增加：

```text
created_by
updated_by
```

## 19. 页面结构

V1 增加用户管理入口：

```text
Yakable

├── Projects
├── ...
└── Settings
      └── Users
```

个人入口：

```text
Avatar
  ├── Profile
  ├── Change Password
  └── Logout
```

## 20. 用户管理页面

页面保持简单：

```text
Users                             + Add User

Search users     Role     Status

┌───────────────────────────────────────────────┐
│ User      Username    Role    Status    Action│
├───────────────────────────────────────────────┤
│ Wei       weifuwan    ADMIN   Active     ... │
│ Zhang     zhangsan    USER    Active     ... │
│ Li        lisi        USER    Disabled   ... │
└───────────────────────────────────────────────┘
```

V1 不做：

- Dashboard
- 用户统计
- 角色统计
- 登录趋势
- 用户画像

用户管理只负责管理用户。

## 21. 后端接口

V1 建议保持清晰的资源式 API：

```http
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/user/me
PUT    /api/user/me/password

GET    /api/users
POST   /api/users
GET    /api/users/{id}
PUT    /api/users/{id}

PUT    /api/users/{id}/status
PUT    /api/users/{id}/password
```

不建议设计：

```text
POST /enableUser
POST /disableUser
POST /updateUserPassword
```

接口风格继续保持 Yakable 的统一规范。

## 22. 后端结构

按照 Yakable 当前模块划分：

```text
yakable-boot
    UserController
    AuthController

yakable-service
    UserService
    AuthService

yakable-dao
    UserRepository
    UserRepositoryImpl
    UserMapper
    UserEntity
```

### 22.1 Controller

负责：

- HTTP 参数
- DTO
- 接口访问控制
- 结果返回

### 22.2 Service

负责：

- 登录规则
- 用户创建规则
- 用户状态规则
- 管理员保护规则
- 密码修改规则

### 22.3 Repository

负责：

- 用户持久化
- 用户查询

## 23. 核心业务规则

### 23.1 用户名唯一

`username` 全局唯一。

### 23.2 密码不能明文保存

必须使用安全的 Password Encoder 保存密码 Hash。

### 23.3 禁用用户不能登录

`DISABLED` 用户认证直接失败。

### 23.4 普通用户不能访问用户管理接口

只有 `ADMIN` 可以访问用户管理能力。

### 23.5 用户不能禁用自己

避免管理员误操作把当前账号锁定。

### 23.6 最后一个管理员不能被降级或禁用

系统始终保留至少一个：

```text
ACTIVE ADMIN
```

## 24. V1 验收流程

完整流程能够走通：

```text
管理员登录
    ↓
进入用户管理
    ↓
创建 USER
    ↓
USER 登录
    ↓
正常使用 Yakable
    ↓
USER 修改密码
    ↓
重新登录
    ↓
ADMIN 禁用 USER
    ↓
USER 无法再次登录
    ↓
ADMIN 重新启用
    ↓
USER 可以正常登录
```

这条链路跑通，用户管理 V1 即完成。

## 25. 后续演进

未来真正出现以下需求时：

```text
一个用户属于多个团队
多人共同管理一个项目
不同团队数据需要隔离
同一个用户在不同团队权限不同
```

再将当前：

```text
User
```

演进为类似：

```text
Account
   │
Membership
   │
Workspace
```

到那个阶段再引入 Tenant、Membership、RBAC 等模型。

V1 不提前设计。

## 26. 设计原则

用户管理 V1 只回答三个问题：

```text
你是谁？
你能不能登录？
你是不是管理员？
```

暂时不回答：

```text
你属于哪个组织？
你有哪些 Permission？
你在哪个 Workspace？
你管理哪些资源？
```

这些都不是 Yakable 当前需要解决的问题。

> User V1 做小、做稳、做完整。
