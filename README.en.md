# LLM Glance

> A ChatGPT Glance / Minimap browser extension for navigating long conversations.
>
> 中文文档: [README.md](README.md)

---

## Features

- Adds a CodeGlance-style minimap panel to the right side of ChatGPT.
- Marks user messages as lightweight visual blocks for quick navigation.
- Shows the current viewport as a translucent draggable overlay.
- Keeps short conversations compact and grows the Glance panel for long conversations.
- Provides Lens preview on hover with temporary local message excerpts.
- Supports popup settings for language, theme, density, Lens, viewport border, and debug logs.
- Avoids covering ChatGPT's native scrollbar and long-conversation guide.
- Does not upload or persist conversation text.

---

## Installation

### 1. Download the project

Save this repository locally, for example:

```text
LLM-Glance
```

### 2. Load the extension

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `LLM-Glance` project root.
5. Open or refresh [ChatGPT](https://chatgpt.com).

### 3. Update after changes

After editing code, reload the extension from the browser extensions page, then refresh ChatGPT.

---

## Usage

1. Log in to [chatgpt.com](https://chatgpt.com) or [chat.openai.com](https://chat.openai.com).
2. Open any conversation.
3. Use the right-side Glance panel to inspect conversation length and position.
4. Click, drag, wheel, or use keyboard navigation on the viewport to jump through the page.
5. Hover over Glance to show the Lens preview.
6. Press `Alt+Shift+G` to toggle Glance on the current page.

---

## Popup Settings

| Setting | Description |
| --- | --- |
| Enable on page | Enable or disable Glance on the current page |
| Color scheme | Auto, light, dark, high contrast, or soft theme |
| Density | Adjust panel width and information density |
| Lens preview | Toggle hover message excerpts |
| Viewport border | Toggle the viewport outline |
| Debug logs | Print diagnostics in DevTools |
| Language | Switch between Chinese and English |

---

## Local Preview

Open the local demo page directly:

```text
LLM-Glance\demo_preview\index.html
```

Use it to verify layout, viewport mapping, Lens, border toggle, language switching, and long-conversation behavior.

---

## Debugging

Open DevTools on ChatGPT and filter Console logs by:

```text
[LLM Glance]
```

Common states:

| State | Meaning |
| --- | --- |
| `model_empty` | The extension is running, but no renderable user messages are available yet |
| `model_ready` | User messages were detected and modeled |
| `model_error` | Modeling or rendering failed |

Seeing `model_empty` before `model_ready` is normal because ChatGPT may mount historical messages lazily.

### Checks

```powershell
node --check src\content.js
node --check src\popup.js
node --check src\background.js
node --check demo_preview\demo.js
git diff --check
```

---

## Privacy

- LLM Glance does not make network requests.
- It does not upload or persist conversation text.
- Lens excerpts are temporary local UI only.
- Debug snapshots include URL, settings, role counts, scroll target, panel dimensions, and errors, but no chat text.
- User settings are stored locally in `chrome.storage.local`.

---

## Acknowledgements

Thanks to the [Linux.do](https://linux.do/) community for support and feedback.

---

## Product Notes

Product requirements, design boundaries, acceptance criteria, and future iteration notes are maintained in [PRD.md](PRD.md).
