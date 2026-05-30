# LLM Glance

> 面向 ChatGPT 长对话的右侧 Glance / Minimap 浏览器扩展，帮助你快速理解对话结构、定位当前位置，并通过缩略视图快速导航。
>
> English documentation: [README.en.md](README.en.md)

---

## 功能简介

- 在 ChatGPT 页面右侧显示类似代码编辑器 minimap 的 Glance 面板。
- 用轻量色块标记用户消息，帮助快速定位长对话中的提问节点。
- 当前视口以半透明 viewport 显示，可点击、拖动、滚轮或键盘导航。
- 短会话保持紧凑；长会话中 Glance 会按内容长度增长，viewport 保持可拖动。
- 支持 Lens 预览：鼠标悬停在 Glance 上时显示本地消息摘录。
- 支持中英文 popup、配色、密度、Lens、viewport 边框和 debug 开关。
- 兼容 ChatGPT 原生滚动条和长对话 guide，不遮挡原生导航控件。
- 不上传、不存储聊天正文；只在本地读取页面 DOM 并保存用户设置。

---

## 安装方法

### 1. 下载项目

将本项目保存到本地，例如：

```text
LLM-Glance
```

### 2. 在 Microsoft Edge / Chromium 中加载扩展

1. 打开 `edge://extensions` 或 `chrome://extensions`。
2. 开启 Developer mode / 开发者模式。
3. 点击 Load unpacked / 加载已解压的扩展。
4. 选择项目根目录 `LLM-Glance`。
5. 打开或刷新 [ChatGPT](https://chatgpt.com) 页面。

### 3. 更新扩展

修改代码后，在扩展管理页点击 Reload / 重新加载，然后刷新 ChatGPT 页面。

---

## 使用说明

1. 登录 [chatgpt.com](https://chatgpt.com) 或 [chat.openai.com](https://chat.openai.com)。
2. 打开任意对话页面。
3. 页面右侧会出现 LLM Glance 面板。
4. 在 Glance 上点击或拖动 viewport，可快速跳转到对应对话位置。
5. 鼠标悬停在 Glance 上，可通过 Lens 查看附近消息摘录。
6. 使用快捷键 `Alt+Shift+G` 可切换当前页面上的 Glance。

---

## Popup 设置

点击浏览器工具栏中的 LLM Glance 图标，可打开设置面板：

| 设置项 | 说明 |
| --- | --- |
| Enable on page | 启用或关闭当前页面的 Glance |
| Color scheme | 自动、浅色、深色、高对比度、柔和主题 |
| Density | 调整 Glance 宽度和信息密度 |
| Lens preview | 开启或关闭悬停消息摘录 |
| Viewport border | 开启或关闭 viewport 描边 |
| Debug logs | 在 DevTools 输出调试日志 |
| Language | 在中文和 English 之间切换 |

---

## 本地预览

无需登录 ChatGPT，可直接打开本地演示页：

```text
LLM-Glance\demo_preview\index.html
```

预览页可用于检查 Glance 布局、viewport 映射、Lens、边框开关、语言切换和长对话滚动效果。

---

## 调试与验证

### Console 日志

在 ChatGPT 页面打开 DevTools，过滤：

```text
[LLM Glance]
```

常见状态：

| 状态 | 说明 |
| --- | --- |
| `model_empty` | 插件已启动，但当前 DOM 中暂未发现可渲染的用户消息 |
| `model_ready` | 已识别用户消息并完成建模 |
| `model_error` | 建模或绘制过程中出现异常 |

ChatGPT 历史消息可能延迟挂载，先出现 `model_empty`、随后变为 `model_ready` 是正常现象。

### 语法检查

```powershell
node --check src\content.js
node --check src\popup.js
node --check src\background.js
node --check demo_preview\demo.js
git diff --check
```

---

## 隐私说明

- LLM Glance 不发送网络请求。
- 不上传、不持久化聊天正文。
- Lens 摘录只在页面本地临时显示。
- Debug 快照不包含聊天正文，只包含 URL、设置、role 计数、滚动容器、panel 尺寸和错误信息。
- 用户设置保存在浏览器本地的 `chrome.storage.local`。

---

## 🙏 致谢

感谢 [Linux.do](https://linux.do/) 社区的支持与反馈。

---

## 迭代文档

产品需求、设计边界、验收标准和后续规划请查看：[PRD.md](PRD.md)。
