# Yakable Turn Navigator PRD V1

> 状态：Ready  
> 版本：V1  
> 范围：Session / Turn Navigator

## 1. 背景

Session 已经支持持续多轮对话、流式回答、停止与失败恢复，以及长历史分页加载。随着 Turn 数量增加，用户开始遇到新的问题：知道自己之前聊过某个内容，但很难快速找到它。

当前页面主要依赖滚动条和“回到底部”入口。它们适合顺序阅读，但不适合在几十轮甚至更多历史中快速定位。用户需要反复滚动、阅读内容、继续滚动，才能找到之前的 Prompt。

Turn Navigator 用来解决“长 Session 中快速定位和跳转”的问题。它不是新的 Session 管理能力，也不改变 Turn、Message 和 Context 的业务语义。

## 2. 产品目标

Turn Navigator 需要让用户在长 Session 中快速回答三个问题：

- 我现在读到哪一轮了？
- 我之前问过什么？
- 我怎样快速回到那一轮？

用户应能够通过右侧紧凑导航快速浏览 Turn、查看 Prompt 预览、点击或拖动跳转，并在 Streaming、历史分页和长 Session 下保持稳定。

Turn Navigator 的导航单位是 Turn，不是单条 Message。用户的一次 Prompt 及其对应 Assistant 回答共同属于同一个导航节点。

## 3. 本期范围

V1 包含以下能力：

- 以 Turn 为单位展示右侧导航条。
- 标记当前正在阅读的 Turn，以及当前视口内可见的 Turn。
- Hover 或键盘聚焦导航区域时展示 Turn Prompt 预览。
- 点击导航节点或 Prompt 预览跳转到对应 Turn。
- 支持上一 Turn、下一 Turn、回到 Session 开头和回到最新位置。
- 支持在导航条上按住并上下拖动，快速浏览和跳转长 Session。
- 支持靠近节点时的 Fisheye 放大效果，降低细小节点的操作难度。
- 支持正在发送、Streaming、Stop、Failure 和恢复中的 Turn。
- 支持历史分页；目标 Turn 尚未加载时，能够加载必要历史后完成跳转。
- 支持键盘操作和减少动态效果偏好。
- 支持大量 Turn 下的稳定导航，不要求进入 Session 时一次性加载全部 Message 正文。

V1 只作用于当前 Session，不提供跨 Session 导航。

## 4. 本期不包含

V1 不包含 Session 搜索、全文检索、Prompt 搜索和语义搜索。

V1 不包含 AI 自动生成 Turn 摘要、标题、标签或主题分组。导航预览只使用用户已经发送的 Prompt 内容。

V1 不提供 Message 级导航。一个 Turn 中的 USER Message、ASSISTANT Message、部分回答和最终回答都属于同一个导航节点。

V1 不支持用户固定、收藏、隐藏、重排或删除导航节点。

V1 不改变 Session 默认进入最新消息附近的规则，也不保存用户上次离开时的阅读位置。

V1 不为窄屏和移动端设计独立的 Turn Navigator。V1 在窄屏下隐藏右侧导航，保留现有 Session 滚动与回到底部能力。

## 5. 功能与业务规则

### 5.1 导航单位

Turn Navigator 必须以 Turn 为导航单位。

一个已经成立的 Turn 对应一个导航节点。Turn 的 USER Message 作为该节点的主要识别内容。

同一 Turn 中 Assistant 正在生成、生成完成、停止或失败，都不能产生第二个导航节点。

Turn 的状态变化不能改变它在导航中的历史顺序。

### 5.2 显示条件

当前 Session 少于 3 个已经正式成立的可导航 Turn 时，不显示 Turn Navigator。

当前 Session 达到 3 个已经正式成立的可导航 Turn 后，桌面端应显示 Turn Navigator。

尚未正式成立的临时 Turn 不计入 3 个 Turn 的显示阈值。Navigator 已经显示时，可以即时追加新 Prompt 对应的临时节点；Navigator 尚未显示时，不能仅因为临时节点达到阈值而提前出现，待 Turn 正式成立后再重新判断显示条件。

Turn Navigator 默认以紧凑形态固定在消息阅读区域右侧，不应因为出现或展开而改变正文宽度、消息位置或输入区域布局。

### 5.3 导航节点

每个 Turn 必须有一个可识别的导航节点。

导航节点按 Turn 的真实对话顺序排列，最早 Turn 在上，最新 Turn 在下。

当前 Turn 使用最明确的视觉状态标记。当前视口内其他可见 Turn 使用次一级状态标记，其余 Turn 保持弱化状态。

用户 Hover 或键盘聚焦某个节点时，该节点应获得明确反馈，但不能因此丢失“当前 Turn”所在位置。

当 Turn 数量超过导航区域可同时容纳的数量时，导航区域必须仍能访问全部 Turn，不能通过无限压缩节点导致节点不可操作。当前阅读位置和用户正在操作的位置应保持可达。

### 5.4 Prompt 预览

用户 Hover 或键盘进入 Turn Navigator 后，应能够看到 Turn Prompt 预览。

预览内容使用该 Turn 的 USER Message，不使用 Assistant 回答作为导航标题。

Prompt 较长时以单行或紧凑形式省略，不在导航预览中展开完整长文本。换行和连续空白应按阅读需要收敛。

Turn Navigator 使用一个共享 Prompt Preview。Preview 始终只展示当前 Hover、键盘聚焦或 Drag 命中的一个 Turn，不提供可独立滚动的全部 Prompt 列表。

Preview 应明确展示当前正在操作的 Turn Prompt；当前 Turn 的位置继续由导航节点本身表达，不能因为 Preview 切换而丢失当前 Turn 状态。

点击共享 Prompt Preview，与点击对应导航节点具有相同的跳转行为。

Preview 的出现和消失不能改变 Session 当前滚动位置。

### 5.5 当前 Turn

任意时刻只能有一个 Turn 被标记为当前 Turn。

当前 Turn 由消息阅读区域中的固定阅读锚点确定，而不是简单表示“最后一个加载的 Turn”。阅读锚点的具体垂直位置由前端设计确定，但同一版本中必须保持稳定，不能根据 Message 高度或 Turn 数量动态漂移。

当阅读锚点位于某个 Turn 的内容范围内时，该 Turn 为当前 Turn；当阅读锚点位于两个 Turn 之间的空白区域时，取锚点上方最近的 Turn。滚动到 Session 顶部时，最早 Turn 为当前 Turn；滚动到 Session 底部时，最新 Turn 为当前 Turn。

同一个 Turn 的 USER Message 和 ASSISTANT Message 在视口中切换时，只要阅读锚点仍属于该 Turn，当前导航节点就不能在两个 Message 之间重复跳变。

用户滚动到 Session 最底部并阅读最新内容时，最新 Turn 应成为当前 Turn。

用户主动回到历史 Turn 后，即使最新 Turn 正在 Streaming，当前 Turn 也应继续跟随用户正在阅读的位置，不能被后台生成强制切回最新 Turn。

### 5.6 点击跳转

用户点击某个 Turn 导航节点后，消息区域应跳转到该 Turn 的 USER Message 附近，并保证目标内容没有被页面顶部固定区域遮挡。

正常情况下使用平滑跳转；当用户启用了减少动态效果时，应关闭或明显降低非必要滚动动画。

跳转完成后，对应 Turn 应成为当前 Turn。

连续点击不同 Turn 时，以用户最后一次选择的目标为准，旧的跳转不能继续把页面拉回旧目标。

### 5.7 上一轮、下一轮与首尾位置

Turn Navigator 应提供向上一 Turn 和向下一 Turn 快速移动的能力。

上一 Turn 和下一 Turn 都以当前阅读 Turn 为基准，一次只移动一轮，不能因为当前视口同时出现多个 Turn 而跳过中间 Turn。

到达最早 Turn 后，继续向上不能产生无效跳转。

到达最新位置后，继续向下不能产生无效跳转。

Session 开头和最新位置应始终有明确、可达的快速入口，即使长 Session 导致中间导航节点需要滚动浏览。

V1 保留现有“回到底部”入口，同时在 Turn Navigator 中保留“回到最新位置”的终点入口。两者职责不同，但必须到达相同的最终阅读位置，并产生一致的当前 Turn、是否位于最新位置以及 Streaming 跟随状态。

### 5.8 Drag-to-Scrub

用户可以在 Turn Navigator 上按住并上下拖动，通过导航条快速浏览长 Session。

拖动开始后，导航应持续反映指针当前对应的 Turn。

当指针对应的 Turn 正文已经加载时，消息区域可以实时跟随到相应位置。

当指针对应的 Turn 正文尚未加载时，Drag 过程中只更新当前目标和 Prompt Preview，不能因为 pointer move 连续触发历史 Message 加载。用户释放 Drag 后，再为最终目标加载必要历史并完成一次跳转。

拖动过程中应提供对应 Turn 的 Prompt 预览，让用户能够判断当前扫到哪一轮。

轻微按压或很小的移动应仍然能够作为普通点击处理，不能因为用户手部轻微移动就误触发长距离拖动。

拖动过程中导航条本身不能因为自动定位、当前 Turn 更新或 Streaming 而从指针下方移走。

拖动结束后，消息区域停留在用户最终选择的 Turn，不自动返回拖动前位置。

### 5.9 Fisheye

当用户在桌面端将指针靠近导航节点时，当前位置附近的节点可以放大，距离越远放大程度逐步降低。

Fisheye 只用于提升细小节点的可操作性，不能改变 Turn 的顺序，也不能让节点在垂直方向上跳动到其他 Turn 的位置。

Fisheye 不能导致导航区域尺寸不断变化、相邻节点突然错位或用户点击到与预览不一致的 Turn。

用户启用减少动态效果时，Fisheye 动画应关闭或降级，但 Hover、Preview、点击和 Drag 等核心导航能力必须继续可用。

### 5.10 新 Turn 与 Streaming

用户发送新的 Prompt 后，界面已经即时展示该 Prompt 时，Turn Navigator 也应即时出现对应的临时最新节点，使消息区与导航区保持一致。

当 USER Message 成功持久化、Turn 正式成立后，临时节点必须平滑过渡为正式 Turn，不能出现两个相同 Prompt 的导航节点，也不能因为身份切换突然改变用户的导航位置。

如果请求在 USER Message 持久化前失败，该临时导航节点应消失，并继续遵守 Session 对原 Prompt 保留和重试的规则。

Turn 正式成立后，即使后续 Assistant 生成失败或用户 Stop，该 Turn 的导航节点仍然保留。

Assistant Streaming 期间，Prompt 预览保持使用 USER Message，不随着输出内容不断变化。

用户停留在最新位置并正常跟随 Streaming 时，Navigator 可以继续保持最新 Turn 为当前 Turn。

用户已经向上阅读历史时，Streaming 不得强制滚动消息正文、强制展开 Preview、强制把 Navigator 拉回最新 Turn，或者中断用户正在进行的 Drag 操作。

### 5.11 历史分页

Turn Navigator 的可导航范围应覆盖当前 Session 已经成立的全部 Turn，不能只覆盖当前已经加载到页面中的最近 50 条 Message。

进入 Session 后，Navigator 必须能够获得完整 Turn 导航范围所需的最小信息，至少包括 Turn 身份、真实顺序和对应 USER Prompt 预览。获取完整导航范围不能等价于一次性加载整个 Session 的 Message 正文。

Session 原有“默认最近 50 条 Message、按需向上加载更早历史”的规则继续有效。完整 Turn 导航信息与完整 Message 正文是两种不同的数据需求。

当用户选择的目标 Turn 正文当前尚未加载时，系统应获取到完成该次跳转所需的历史内容，再定位到目标 Turn。

加载历史期间应让用户知道跳转仍在进行，不能静默点击后没有反应。

如果目标历史加载失败，页面应保持在当前可用位置，并允许用户重新尝试。

普通向上滚动触发历史加载时，应继续保持原有阅读位置，不能因为新增了更早 Message 而让正文和 Navigator 当前位置突然跳动。

### 5.12 长 Session

Turn Navigator 必须面向长 Session 设计。

导航能力不能依赖“所有历史 Message 正文必须同时存在于页面中”这一前提。

至少在 500 个 Turn 的测试数据下，用户仍应能够进入导航、查看 Prompt 预览、点击跳转、拖动浏览和使用键盘操作，不能因为 Turn 数量增加而让导航节点压缩到不可操作。

长 Session 中导航区域可以只保持当前附近节点在视野中，但必须能够继续到达任意已成立 Turn。

### 5.13 键盘与可访问性

Turn Navigator 必须可以在不使用鼠标的情况下完成核心操作。

用户通过 Tab 进入 Navigator 后，不应被迫依次 Tab 经过所有 Turn 才能离开导航区域。

在 Navigator 内，用户应能够使用方向键逐 Turn 移动焦点，使用 Home / End 快速到达最早和最新位置，并使用 Enter 或 Space 跳转到当前聚焦 Turn。

从 Navigator 触发跳转后，键盘焦点应能够进入目标 Turn 的消息内容，使键盘和辅助技术用户可以从跳转位置继续阅读。

桌面端提供 Shift + Alt + M 快捷键，将焦点移动到 Turn Navigator 当前 Turn；当 Navigator 未显示时，该快捷键不能阻止浏览器或其他功能的正常按键行为。

Navigator 的当前 Turn、可操作节点、上一轮、下一轮、开头和最新位置都应具有可理解的无障碍名称和状态。

### 5.14 窄屏

V1 在窄屏下隐藏 Turn Navigator，不应为了保留右侧导航而挤压消息正文或输入框。

隐藏 Navigator 后，现有 Session 滚动、历史加载和回到底部能力继续正常工作。

移动端是否使用抽屉、浮层或其他形式的 Turn 导航，后续单独设计。

## 6. 验收标准

当 Session 少于 3 个正式成立的可导航 Turn 时，桌面端不显示 Turn Navigator；达到 3 个后显示右侧紧凑导航，且不改变消息正文和输入框原有布局。临时 Turn 不计入显示阈值；Navigator 已经显示时允许追加临时节点，尚未显示时不因临时节点闪现。

每个已成立 Turn 只有一个导航节点。USER Message 和 ASSISTANT Message 属于同一个节点；Turn 从 PENDING / RUNNING 到 SUCCEEDED、FAILED 或 STOPPED 时，不新增重复节点，也不改变历史顺序。

用户 Hover、键盘聚焦或 Drag Navigator 时能够看到一个共享的 USER Prompt Preview；任意时刻只预览当前命中的一个 Turn，不出现可独立滚动的全部 Prompt 列表。长 Prompt 正确省略，关闭 Preview 后 Session 阅读位置保持不变。

用户正常滚动时，Current Turn 按固定阅读锚点稳定变化；同一 Turn 的 USER / ASSISTANT 内容跨越视口时不会产生无意义的 Message 级跳变。

用户点击任意已加载 Turn 的节点或 Prompt 预览后，页面能够定位到对应 USER Message，目标不被顶部区域遮挡，最终当前 Turn 与目标一致。快速连续点击多个目标时，最终停留在最后一次选择的 Turn。

上一轮和下一轮一次只移动一个 Turn；最早 Turn、最新位置和现有回到底部入口行为一致，不出现已经到底仍可继续无效跳转的状态。Navigator 的“回到最新位置”和现有“回到底部”最终到达相同阅读位置，并产生一致的 Current Turn 和 Streaming 跟随状态。

用户可以按住 Navigator 上下拖动，从长 Session 的一个区域快速移动到另一个区域。已加载 Turn 可以让正文实时跟随；经过尚未加载的历史 Turn 时只更新目标和 Preview，不连续请求历史 Message，释放后只为最终目标加载并完成跳转。轻微移动仍按普通点击处理，不产生误拖动。

Fisheye 能够扩大指针附近节点的可操作范围，邻近节点不会因为放大而发生顺序错乱、跳动或预览与点击目标不一致。开启减少动态效果后，核心导航功能仍然完整可用。

用户发送 Prompt 后，消息区即时出现的新 Prompt 与 Navigator 临时节点保持一致；Turn 正式建立后只有一个正式节点。建立前失败时临时节点消失；建立后的 Stop 或 Failure 不删除该 Turn 节点。

Assistant Streaming 时，如果用户停留在最新位置，Navigator 可以继续跟随最新 Turn；如果用户正在阅读历史或操作 Navigator，Streaming 不会强制把正文或 Navigator 拉回最新位置。

Session 历史超过首屏最近 50 条 Message 时，Navigator 仍能够获得全部已成立 Turn 的最小导航信息，并能够到达更早 Turn；不能为了构建 Navigator 一次性加载全部 Message 正文。点击或 Drag 最终选择尚未加载正文的历史 Turn 后，系统先加载必要历史再完成定位；加载失败不会破坏当前阅读位置，并允许重试。

使用至少 500 个 Turn 的测试数据时，Navigator 仍能够完成 Preview、点击跳转、Drag-to-Scrub、上一轮 / 下一轮和键盘导航，不能要求预先渲染全部历史 Message 正文才能工作。

键盘用户可以通过 Tab 进入 Navigator，使用方向键、Home / End、Enter / Space 完成 Turn 选择和跳转，并在跳转后继续从目标消息阅读；Tab 不需要遍历全部 Turn。Shift + Alt + M 在 Navigator 存在时能够将焦点带回当前 Turn 节点。

窄屏隐藏 Turn Navigator 后，Session 原有消息滚动、历史分页、Streaming 和回到底部能力不受影响。

以上主流程、长历史、Streaming、拖动、键盘和恢复边界全部满足后，Turn Navigator V1 才算完成。

## 7. 后续演进

如果用户后续需要按关键词、主题或语义定位历史内容，再单独增加 Session Search，而不是继续扩大 Turn Navigator 的职责。

如果移动端长 Session 导航需求明确，再设计适合触摸操作的独立入口和交互，不直接把桌面右侧导航压缩到移动端。

如果未来 Message List 引入更强的窗口化或虚拟化，Turn Navigator 仍应保持完整 Turn 导航语义；具体实现由前端设计约束，不修改本 PRD 的产品规则。

如果未来一个 Project 支持多个 Session，Turn Navigator 仍只负责当前 Session 内部定位，跨 Session 导航由 Session 管理能力负责。
