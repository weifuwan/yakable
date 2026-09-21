# Yakable Project PRD V1

> 状态：Draft  
> 版本：V1  
> 范围：Project

## 1. 背景

Yakable 需要一个稳定的容器，把用户围绕同一个目标产生的多次对话和后续工作组织在一起。  
如果只有 Session 或 Message，用户很难长期回到同一个工作上下文，也无法形成清晰的最近项目入口。  
Project 用来承载这层长期上下文，但不承担一次具体 AI 生成过程的状态。

## 2. 产品目标

Project V1 需要让用户能够从一个 Prompt 创建项目，并立即进入这个项目继续工作。  
用户之后能够从 Recent Projects 找回自己的项目，并进入该项目最近使用的 Session。  
Project 只负责“这个工作是什么、属于谁、从哪里继续”，不提前承担复杂项目管理能力。

## 3. 本期范围

本期包含 Project 创建、Project 详情、Recent Projects 列表和 Project 打开行为。  
创建 Project 时同时建立第一个 Session，并把创建时的 Prompt 作为这个 Session 的第一条用户输入。  
用户选择的模型用于初始化第一个 Session，不作为 Project 永久绑定的模型。

每个 Project 必须属于创建它的用户。  
V1 用户只能看到和进入自己创建的 Project；ADMIN 的用户管理权限不代表可以查看其他用户的 Project。  
不存在的 Project 和不属于当前用户的 Project，都应表现为不可访问，不能泄露其他用户的 Project 是否存在。

## 4. 本期不包含

V1 不包含 Project 删除、归档、复制、收藏、标签、文件夹、分享和多人协作。  
V1 不包含手动修改 Project 名称，也不提供独立的 All Projects、搜索和高级筛选页面。  
这些能力只有在真实产品需求出现后再单独设计。

V1 不为 Project 设计用户可操作的生命周期状态。  
“生成中、成功、失败、停止”等状态属于 Session 或 Turn，而不是 Project。  
Project 创建成功后即作为一个可持续进入的工作空间存在。

## 5. 功能与业务规则

### 5.1 Project 是什么

一个 Project 表示用户围绕同一个目标持续工作的空间。  
Project 可以包含一个或多个 Session，但 Project 本身不等同于一次对话，也不等同于一次 AI 生成。  
Session 的创建、切换、停止和上下文规则由 Session PRD 单独定义。

### 5.2 创建 Project

用户从 Dashboard 输入非空 Prompt，并选择一个可用模型后，可以创建 Project。  
系统创建 Project 时必须同时创建第一个 Session，并保存第一条用户输入。  
Project、初始 Session 或第一条用户输入任一无法建立时，本次创建都应失败，不能留下用户可见的不完整 Project。

Project 和初始 Session 建立成功后，应立即进入 Project 页面。  
页面跳转不需要等待 AI 完成回答，AI 的执行结果不能阻塞 Project 创建成功。  
如果后续 AI 生成失败，已经创建的 Project 和 Session 仍然保留，用户之后仍可再次进入。

### 5.3 Project 名称

用户创建 Project 时不需要额外填写名称。  
Project 名称由系统根据首次 Prompt 自动生成，优先使用 Prompt 的第一行有效内容，并去除首尾空白。  
名称最长 48 个字符，超出部分应以简洁方式省略，不能因为 Prompt 很长而影响列表可读性。

Project 名称创建后在 V1 中保持不变。  
用户后续在 Session 中发送的新消息，不自动修改 Project 名称。  
手动重命名不属于 V1 范围。

### 5.4 Project 与 Session

每个成功创建的 Project 至少拥有一个初始 Session。  
创建 Project 时选择的模型和首次 Prompt 属于这个初始 Session，Project 本身不保存“当前模型”的产品含义。  
未来同一个 Project 是否创建更多 Session，以及新 Session 如何命名和切换，由 Session PRD 定义。

Project 需要能够识别最近使用的 Session。  
用户从 Project 列表重新进入一个 Project 时，应默认进入这个 Project 最近使用的 Session。  
用户不需要先经过一个空的 Project 中转页再选择 Session。

### 5.5 Recent Projects

登录后，侧边栏提供 Recent Projects，展示当前用户最近使用的 Project。  
首次默认加载 20 个 Project；继续向下滚动时可以按页追加，不一次加载全部历史 Project。  
没有 Project 时显示明确空状态，加载失败时允许用户重新尝试。

Recent Projects 按最近活动时间从新到旧排列。  
Project 刚创建时应立即出现在列表顶部；后续 Session 产生新的有效交互后，对应 Project 也应回到更靠前的位置。  
列表中的 Project 至少展示名称，并能够直接进入其最近使用的 Session。

### 5.6 打开 Project

用户通过 Recent Projects 打开 Project 时，系统应进入该 Project 最近使用的 Session。  
刷新 Project 页面后，当前 Project 和 Session 应能够通过持久化数据恢复，不能依赖浏览器临时状态。  
如果目标 Project 不存在、已经不可访问或不属于当前用户，应进入统一的不可用处理，而不是展示其他用户的数据。

### 5.7 Project 与 AI 执行失败

Project 创建成功和 AI 回答成功是两个不同结果。  
只要 Project、初始 Session 和第一条用户输入已经建立，后续模型调用失败不能删除 Project。  
用户重新进入 Project 时，应仍然能够看到已有对话状态，具体失败展示和继续对话规则由 Session PRD 定义。

## 6. 验收标准

用户登录后输入 Prompt 并选择模型，可以创建一个属于自己的 Project。  
创建成功后立即进入该 Project 的初始 Session，不需要等待 AI 完成回答；新 Project 同时出现在 Recent Projects 顶部。  
刷新页面后仍然能够恢复并进入同一个 Project 和 Session。

Project 名称能够从首次 Prompt 自动生成，空白内容不能创建 Project，长名称不会破坏 Recent Projects 的可读性。  
同一 Project 后续产生新的 Session 活动后，应按照最近活动重新排序；超过 20 个 Project 时能够继续加载更多。  
AI 回答失败时，已经创建的 Project 不会消失。

用户只能查询和打开自己的 Project。  
普通 USER 和 ADMIN 都不能因为知道其他用户的 Project ID 而读取对应内容，ADMIN 身份本身不授予跨用户 Project 访问权限。  
不存在的 Project 与无权访问的 Project 不应暴露可区分的信息。

Project V1 不出现删除、归档、分享、重命名、复杂状态管理等本期未定义能力。  
以上主流程、归属规则、异常边界和列表行为全部满足后，Project V1 才算完成。

## 7. 后续演进

后续可以根据真实需求增加 Project 重命名、删除或归档、搜索、收藏、分享和协作。  
如果未来引入 Workspace 或团队空间，再重新定义 Project 的归属和访问模型，而不是提前把多租户结构塞进 V1。  
Project 内多 Session 的完整产品规则在 Session PRD 中继续定义。
