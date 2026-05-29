# LLM Glance

LLM Glance is a Microsoft Edge Manifest V3 extension that adds a CodeGlance-style panel to the right edge of ChatGPT. The first version renders only user chat modules in the Glance panel so long conversations can be scanned and navigated quickly without sending message content anywhere.

## Version 1.0 Scope

- ChatGPT first: `https://chatgpt.com/*` and `https://chat.openai.com/*`.
- Local-only abstraction: user message blocks only. Assistant replies are intentionally not rendered in v1.
- CodeGlance-style panel anchored beside the detected scrollable conversation area, with canvas rendering, viewport dragging, mouse wheel navigation, keyboard navigation, and a resize handle.
- Popup and right-click menu settings stored in `chrome.storage.local`.
- Keyboard command: `Alt+Shift+G` toggles the rail on the active tab.

## Load in Microsoft Edge

1. Open `edge://extensions`.
2. Turn on Developer mode.
3. Choose Load unpacked.
4. Select this project folder: `D:\ReadboyProject\SelfProject\LLM-Glance`.
5. Open ChatGPT and use the LLM Glance toolbar popup or `Alt+Shift+G`.

## Local Visual Preview

Open `demo/preview.html` in Edge to preview the same Glance panel without signing in to ChatGPT. The preview uses an internal scroll area plus a reserved right-side Glance column, and it loads `src/content.js` directly, so it is useful for checking the scroll-area anchoring, current viewport overlay, overall conversation length scale, and user-message-only rendering before reloading the extension.

## Debugging

Open DevTools on the ChatGPT tab and filter for `[LLM Glance]`. Startup logs report the adapter match, settings, scroll target, role counts, model status, panel size, and any last error without logging chat text. In the toolbar popup, turn on Debug logs for detailed refresh logs, or click Copy debug to copy the current structured status snapshot.

## Files

- `manifest.json`: MV3 extension metadata, ChatGPT host scope, command, popup, background, and content script.
- `src/content.js`: ChatGPT adapter, minimap model, Shadow DOM UI, Canvas renderer, navigation, and settings sync.
- `src/popup.*`: toolbar popup for settings and page commands.
- `src/background.js`: install defaults and keyboard command bridge.
- `icons/*.png`: extension icons.

## Privacy

The extension does not make network requests and does not persist conversation text. Only settings are stored locally.
