# LLM Glance

> A Microsoft Edge extension that adds a ChatGPT Glance / Minimap panel.
>
> 中文文档: [README.md](README.md)

## Overview

LLM Glance is a Microsoft Edge Manifest V3 extension that adds a CodeGlance-style minimap panel to ChatGPT. It helps users navigate long conversations by rendering lightweight visual blocks on the right side of the page.

Version 1 intentionally stays small: it renders only user message blocks. Assistant replies are not rendered in the Glance panel yet.

## Requirements

- Built for Microsoft Edge / Chromium with Manifest V3.
- Supports ChatGPT first: `https://chatgpt.com/*` and `https://chat.openai.com/*`.
- Inspired by CodeGlancePro and the local `temp_demo`.
- Adds a Glance panel beside the scrollable conversation area, not a floating chat window.
- Keeps the native scrollbar/drag handle on the left side of Glance instead of covering it.
- Renders user messages only in v1.
- Does not upload or persist conversation text.
- Provides startup logs and copyable debug snapshots for troubleshooting.

## Design

### Why CodeGlancePro

The value of CodeGlancePro is not simply showing code. It compresses a long content space into a minimap so users can quickly understand:

- Where the current viewport sits in the whole document.
- How long the whole document is.
- Where meaningful markers exist.
- Whether they can drag the viewport to navigate quickly.

LLM Glance applies the same model to long LLM conversations. Code lines become chat modules, and syntax markers become message-role markers. In v1, user messages are the only rendered anchors because they are usually the clearest navigation landmarks.

### Why User Messages Only

ChatGPT assistant replies can be very long and may include tables, code blocks, citations, and tool results. Rendering everything in v1 would turn the extension into a complex parser. This version focuses on navigation and the visual model first:

- User prompts are often the most useful anchors in a long conversation.
- Rendering only user messages prevents long assistant replies from overwhelming the minimap.
- Assistant replies, code blocks, search hits, and summaries can be added later on top of the stable minimap foundation.

### Layout Principles

- The Glance panel sits to the right of the scrollable conversation area.
- The native scrollbar/drag handle remains on the left side of Glance.
- If the page already has right-side space, Glance uses it directly.
- If space is insufficient, the extension reserves `margin-inline-end` on the actual scroll container so the scrollbar naturally moves to the left of Glance.
- The current viewport is represented by a translucent frosted overlay that moves with page scrolling.

## Current Features

- User-message-only block rendering based on `data-message-author-role="user"`.
- Canvas rendering to avoid heavy DOM updates.
- Shadow DOM isolation to reduce style conflicts with ChatGPT.
- Fixed-height viewport overlay that moves with scrolling while the Glance panel grows with conversation length.
- Click, drag, wheel, and keyboard navigation.
- Automatic width adjustment based on density and user message count.
- Scroll container detection tuned for ChatGPT.
- Startup retries for delayed ChatGPT DOM rendering.
- Structured `[LLM Glance]` console logs without chat text.
- Popup controls for enable/disable, theme, density, debug logs, refresh, and copy debug.

## Not Included Yet

- Assistant reply rendering.
- Code block parsing.
- Conversation summaries.
- External LLM/API integration.
- Other LLM sites.
- Edge Sidebar / Side Panel integration.

## Files

- `manifest.json`: MV3 metadata, host permissions, popup, background, content script, and command.
- `src/content.js`: ChatGPT adapter, Glance model, Shadow DOM UI, Canvas renderer, navigation, and debug logs.
- `src/popup.html` / `src/popup.css` / `src/popup.js`: toolbar popup settings and debug controls.
- `src/background.js`: default settings and keyboard command bridge.
- `demo/preview.html`: local visual preview page, no ChatGPT login required.
- `scripts/verify-preview.cjs`: Playwright-based local verification script.
- `temp_demo/`: CodeGlance-style design and interaction reference.
- `icons/`: extension icons.

## Run in Microsoft Edge

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `D:\ReadboyProject\SelfProject\LLM-Glance`.
5. Open ChatGPT.
6. After code changes, reload the extension and refresh ChatGPT.

Shortcut: `Alt+Shift+G` toggles Glance on the active tab.

## Local Preview

Open:

```text
D:\ReadboyProject\SelfProject\LLM-Glance\demo\preview.html
```

The preview loads `src/content.js` directly and is useful for checking:

- Whether Glance is placed to the right of the scroll area.
- Whether the native scrollbar remains to the left of Glance.
- Whether the viewport overlay maps the visible area correctly.
- Whether user-only rendering works.
- Whether width and scaling behave correctly in long conversations.

## Debugging

Open DevTools on the ChatGPT tab and filter Console logs by:

```text
[LLM Glance]
```

Important events:

- `script_loaded`: content script loaded.
- `adapter_matched`: ChatGPT adapter matched the page.
- `settings_loaded`: local settings loaded.
- `scroll_container_detected`: scroll target selected.
- `message_scan_done`: message scan completed.
- `model_empty`: no user message blocks are currently available in the mounted DOM.
- `model_ready`: user message blocks were detected.
- `model_error`: model or rendering failed.

Seeing `model_empty` first and `model_ready` a few seconds later is normal on ChatGPT because the conversation DOM may mount lazily.

In the popup, enable Debug logs for detailed refresh logs, or click Copy debug to copy the current structured status snapshot. The debug snapshot includes URL, settings, role counts, scroll target, panel dimensions, and errors; it does not include chat text.

## Verification

```powershell
node --check src\content.js
node --check src\popup.js
node --check src\background.js
node --check scripts\verify-preview.cjs
node scripts\verify-preview.cjs
git diff --check
```

`scripts\verify-preview.cjs` verifies:

- Glance DOM completeness.
- Panel placement beside the scroll container.
- `empty` state for assistant-only pages.
- Automatic recovery to `ready` after delayed user message insertion.
- User-message-only rendering.
- Scroll-area reservation when there is no pre-existing right-side column, so the native scrollbar stays to the left of Glance.

## Privacy

LLM Glance does not make network requests, upload chat content, or persist conversation text. It only reads local DOM structure and stores extension settings in `chrome.storage.local`.
