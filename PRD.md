# LLM Glance PRD

## 1. 产品概述

LLM Glance 是一个面向 ChatGPT 长对话场景的浏览器扩展。它在页面右侧提供类似代码编辑器 minimap 的 Glance 面板，用压缩视图展示对话结构和当前位置，帮助用户在长对话中快速浏览、定位和跳转。

当前版本优先服务 ChatGPT 页面，运行在 Microsoft Edge / Chromium Manifest V3 扩展体系中。

## 2. 目标用户与核心场景

- 高频使用 ChatGPT 进行长对话、学习、研究、调试或写作的用户。
- 需要在数十轮甚至更长的对话中快速回到某个提问节点的用户。
- 希望保留 ChatGPT 原生页面体验，同时补充长内容导航能力的用户。

核心场景：

- 快速理解当前对话长度。
- 快速判断当前视口在整段对话中的位置。
- 通过右侧 viewport 拖动或点击跳转到目标区域。
- 在 Glance 上悬停查看附近消息摘录。

## 3. 当前版本范围

### 已包含

- 支持 `https://chatgpt.com/*` 和 `https://chat.openai.com/*`。
- 在真实滚动容器右侧显示 Glance 面板。
- 保留 ChatGPT 原生滚动条，并避免覆盖原生长对话 guide。
- 使用 Canvas 渲染用户消息色块。
- 根据对话长度动态计算 Glance 高度。
- 无滚动条时 Glance 和 viewport 可小于 120px；出现滚动条后 viewport 固定为 120px。
- 支持点击、拖动、滚轮和键盘导航。
- 支持 Lens 本地消息摘录。
- 支持启用状态、主题、密度、Lens、viewport 边框、debug logs 和中英文 popup。
- 支持可复制 debug 快照，便于排查 DOM 识别和滚动容器问题。

### 暂不包含

- 不渲染助手回复色块。
- 不解析代码块、表格或引用结构。
- 不生成对话摘要。
- 不接入任何 LLM API。
- 不支持 Claude、Gemini、DeepSeek、Kimi 等其他站点。
- 不使用 Edge Sidebar / Side Panel。

## 4. 功能需求

### Glance 面板

- 面板应贴近 ChatGPT 实际滚动区域右侧，而不是作为独立聊天窗口浮动。
- 如果页面右侧空间不足，应为滚动区域预留空间，使原生滚动条位于 Glance 左侧。
- 面板宽度由 density 和对话规模共同决定，并保留用户 resize 能力。
- 面板背景保持透明，尽量融入当前页面底色。

### Viewport

- viewport 表示当前页面可见区域。
- 出现滚动条后 viewport 高度固定为 120px，保证可拖动性。
- 无滚动条时 viewport 与 Glance 可按真实内容缩放到小于 120px。
- 点击、拖动、滚轮、键盘导航应使用同一套文档坐标映射，确保顶部和底部对齐准确。

### 消息标记

- 当前版本只渲染用户消息色块。
- 消息高度和位置应来自真实 DOM 位置。
- 用户消息色块常态显示，不依赖 viewport 是否经过该消息。

### Lens

- 鼠标悬停在 Glance 上时，在面板外侧显示 Lens 预览。
- Lens 内容为本地 DOM 中命中的消息角色、序号和正文摘录。
- Lens 不写入 storage，不进入 debug 快照，不上传正文。
- 拖动 viewport、关闭 Lens 设置、鼠标离开 Glance 时应隐藏 Lens。

### ChatGPT 原生控件兼容

- 不覆盖 ChatGPT 原生滚动条。
- 不覆盖超长对话中出现的 ChatGPT 原生 guide / TOC 浮层。
- guide 避让使用可恢复的 inline `translate`，插件关闭或 guide 消失后应恢复原样。

### Popup

- Popup 应提供启用状态、主题、密度、Lens、viewport 边框、debug logs、刷新、复制 debug、语言切换。
- 语言默认按浏览器语言自动解析。
- 用户切换语言后应持久化。
- 快速连续切换多个设置时，最终状态必须保存并同步到 content script。

## 5. 非功能需求

- 不发送网络请求。
- 不上传、不持久化聊天正文。
- content script 应尽量减少滚动帧中的 DOM 查询、布局读取和 debug 快照构造。
- 长对话滚动时，viewport 同步应保持顺滑。
- 扩展样式应使用 Shadow DOM 隔离，避免污染 ChatGPT 页面。
- ChatGPT DOM 延迟挂载时，应通过启动重试恢复建模。

## 6. 调试与验收

### Debug 快照

Copy debug 应包含：

- URL、host、启用状态和用户设置。
- message role 统计和用户块数量。
- 滚动容器信息。
- panel 宽度、高度、viewport、documentHeight、guide 避让状态。
- 最近错误信息。

Debug 快照不应包含聊天正文。

### 手动验收场景

- 一句短对话：Glance 和 viewport 紧凑，不出现长空白轨道。
- 一屏内多句：Glance 仍保持紧凑，viewport 接近铺满。
- 2-3 屏内容：Glance 逐步增长，viewport 固定且可拖动。
- 超长对话：Glance 达到可用高度上限，viewport 可拖到底并严格对齐页面底部。
- Lens：hover 显示摘录，关闭开关或离开后隐藏。
- Guide：ChatGPT 原生 guide 被推到 Glance 左侧，插件关闭后恢复。
- Popup：快速切换多个设置后，关闭重开仍保持最后状态。

### 静态验证命令

```powershell
node --check src\content.js
node --check src\popup.js
node --check src\background.js
node --check demo_preview\demo.js
git diff --check
```

## 7. 后续迭代方向

- 可选渲染助手回复、代码块、搜索命中或收藏标记。
- 支持更多 LLM 网站。
- 增加更细粒度的 minimap 标记类型。
- 增加正式打包、版本发布和安装说明。
- 增加自动化浏览器验证脚本，覆盖长对话、Lens、guide 避让和 popup 状态保存。
