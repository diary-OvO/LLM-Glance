# LLM Glance

> 一个面向 Microsoft Edge 的 ChatGPT 对话 Glance / Minimap 插件。
>
> English documentation: [README.en.md](README.en.md)

## 项目概述

LLM Glance 是一个 Microsoft Edge Manifest V3 浏览器插件，目标是在 ChatGPT 页面右侧增加一个类似 CodeGlancePro 的 Glance 窗体，用轻量色块展示长对话的位置结构，帮助用户快速理解当前对话长度、当前视口位置，并通过拖动/滚轮快速导航。

第一版不是做摘要、不是解析代码、也不是渲染完整 LLM 回复。它只做一件事：把用户消息模块映射成右侧 Glance 色块，并保留原页面滚动拖拽条在 Glance 左边，尽量接近代码编辑器 minimap 的使用感。

## 核心需求

- 基于 Edge / Chromium 扩展体系，使用 Manifest V3。
- 首批只支持 ChatGPT：`https://chatgpt.com/*` 和 `https://chat.openai.com/*`。
- 参考 CodeGlancePro / `temp_demo` 的设计理念：右侧 Glance 面板、当前视口 viewport、整体内容比例、可拖动导航。
- Glance 不是浮动聊天窗口，而是贴近页面右侧滚动区域的窗体。
- 保留 ChatGPT 原生滚动条和拖拽条，并让它位于 Glance 左边，避免被覆盖。
- 第一版只渲染用户消息色块，不渲染助手回复。
- 不上传、不存储聊天正文；只把用户设置保存在 `chrome.storage.local`。
- 支持启动日志和可复制 debug 快照，方便定位 ChatGPT DOM 延迟挂载、滚动容器识别、用户消息识别等问题。

## 设计思路

### 为什么参考 CodeGlancePro

CodeGlancePro 的核心价值不是“显示代码本身”，而是用 minimap 的方式把一个超长内容空间压缩到右侧，使用户能快速理解：

- 当前视口在整体内容中的位置。
- 整体内容有多长。
- 哪些区域存在有意义的标记。
- 是否可以通过拖动右侧 viewport 快速跳转。

LLM Glance 将这个思路从“代码文件”迁移到“长对话”。代码行被替换为聊天模块，代码高亮被替换为消息角色标记。第一版为了稳定和清晰，只标记用户消息。

### 为什么只渲染用户消息

ChatGPT 的助手回复可能非常长，且包含表格、代码块、引用、工具结果等复杂 DOM。如果第一版同时渲染所有内容，容易变成复杂解析器。当前版本优先解决导航和视觉模型：

- 用户问题通常是长对话中最重要的定位锚点。
- 只渲染用户消息可以避免助手长回复淹没 Glance。
- 后续可以在稳定的 minimap 基础上再扩展助手回复、代码块、搜索命中或摘要标注。

### 布局原则

- Glance 面板放在滚动区域右侧。
- 原生滚动拖拽条保留在 Glance 左边。
- 如果页面已有右侧空间，Glance 直接使用该空间。
- 如果空间不足，插件会给实际滚动容器预留 `margin-inline-end`，让滚动容器收窄，原滚动条自然移动到 Glance 左侧。
- 当前视口用浅透明毛玻璃 viewport 表示，随页面滚动同步移动。

## 当前能力

- 用户消息色块渲染：只读取 `data-message-author-role="user"` 对应节点。
- Canvas 渲染：避免大量 DOM 色块影响页面性能。
- Shadow DOM 隔离：减少插件样式和 ChatGPT 页面样式互相污染。
- 当前视口显示：无滚动条时 viewport 和 Glance 可小于 120px；出现滚动条后 viewport 固定为 120px，Glance 面板根据对话长度动态生长。
- 点击/拖动/滚轮导航：在 Glance 上交互可同步滚动对话页面。
- 自动宽度：根据密度和用户消息数量在合理范围内调整 Glance 宽度。
- 滚动容器识别：优先选择真实可滚动容器，避免把普通 `main` 内容容器误判为滚动容器。
- Lens 预览：在 Glance 上悬停时显示本地消息摘录，不存储或上传正文。
- 启动重试：ChatGPT DOM 延迟挂载时，插件会在启动后短时间内主动重试建模。
- Debug 日志：Console 中输出 `[LLM Glance]` 结构化启动日志，不包含聊天正文。
- Popup 设置：支持启用状态、配色、密度、Lens、viewport 边框、Debug logs、刷新、复制 debug 信息和中英文切换。

## 暂不包含

- 不渲染助手回复。
- 不解析代码块。
- 不生成对话摘要。
- 不接入任何 LLM API。
- 不支持 Claude、Gemini、DeepSeek、Kimi 等其他站点。
- 不使用 Edge Sidebar / Side Panel。

## 文件结构

- `manifest.json`：MV3 插件声明、host 权限、popup、background、content script、快捷键。
- `src/content.js`：ChatGPT adapter、Glance 模型、Shadow DOM UI、Canvas 渲染、滚动导航、debug 日志。
- `src/popup.html` / `src/popup.css` / `src/popup.js`：工具栏 popup 设置与调试入口。
- `src/background.js`：默认设置初始化和快捷键转发。
- `demo_preview/index.html` / `demo_preview/demo.css` / `demo_preview/demo.js`：本地视觉预览页面，不需要登录 ChatGPT。
- `temp_demo/`：CodeGlance 风格设计与交互参考。
- `icons/`：扩展图标。

## 在 Microsoft Edge 中运行

1. 打开 `edge://extensions`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择项目目录：`D:\ReadboyProject\SelfProject\LLM-Glance`。
5. 打开 ChatGPT 页面。
6. 如果修改了代码，请回到 `edge://extensions` 点击插件卡片上的 Reload，再刷新 ChatGPT 页面。

快捷键：`Alt+Shift+G` 可以切换当前页面上的 Glance。

## 本地预览

可以直接打开：

```text
D:\ReadboyProject\SelfProject\LLM-Glance\demo_preview\index.html
```

这个页面用于演示 Glance 的 temp-demo 风格交互，可验证：

- Glance 是否贴在滚动区域右侧。
- 原滚动条是否保留在 Glance 左边。
- viewport 是否能表达当前可见区域。
- 只渲染用户消息是否正确。
- Lens 是否能在 Glance 外侧显示消息摘录。
- Marks / viewport 边框开关是否生效。
- 语言按钮是否能在中英文间切换。
- 长对话下宽度和比例是否正常。

## 调试方法

打开 ChatGPT 页面的 DevTools Console，过滤：

```text
[LLM Glance]
```

常见日志含义：

- `script_loaded`：content script 已加载。
- `adapter_matched`：当前页面匹配 ChatGPT adapter。
- `settings_loaded`：已读取本地设置。
- `scroll_container_detected`：已识别滚动容器。
- `message_scan_done`：完成一次消息扫描。
- `model_empty`：插件已启动，但当前 DOM 中还没有可渲染的用户消息节点。
- `model_ready`：已识别用户消息并完成建模。
- `model_error`：建模或绘制异常。

ChatGPT 页面经常会延迟挂载历史消息，所以看到先 `model_empty`、几秒后 `model_ready` 是正常现象。

Popup 中可以开启 Lens、切换 viewport 边框、开启 Debug logs 获取更详细刷新日志，也可以点击 Copy debug 复制当前结构化状态。Lens 摘录只在本地临时显示；Debug 快照只包含 URL、设置、role 计数、滚动容器、panel 尺寸和错误信息，不包含聊天正文。

## 验证命令

```powershell
node --check src\content.js
node --check src\popup.js
node --check src\background.js
node --check demo_preview\demo.js
git diff --check
```

本地预览页重点验证：

- Glance DOM 是否完整。
- 面板是否贴在滚动容器右侧。
- Lens 悬停预览是否跟随鼠标并在离开后隐藏。
- Marks / viewport 边框开关是否能即时生效。
- 语言按钮是否切换演示文案。
- 是否只渲染用户消息。
- 无预留列场景下，滚动区域是否被收窄，让原滚动条位于 Glance 左边。

## 隐私说明

LLM Glance 不发送网络请求，不上传聊天内容，也不持久化聊天正文。插件只在页面本地读取 DOM 位置和角色节点，用于绘制 Glance；用户设置保存在 `chrome.storage.local`。
