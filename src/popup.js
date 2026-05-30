"use strict";

const STORAGE_KEY = "llmgSettings";

const DEFAULT_SETTINGS = {
  enabled: true,
  theme: "dark",
  density: "comfortable",
  widthMode: "auto",
  lensEnabled: true,
  viewportBorder: true,
  locale: "auto",
  debug: false
};

const I18N = {
  en: {
    checking: "Checking this tab...",
    settingsLabel: "Glance settings",
    enableTitle: "Enable on page",
    enableHelp: "Show the ChatGPT Glance panel.",
    themeLabel: "Color scheme",
    themeAuto: "Auto",
    themeLight: "Light",
    themeDark: "Dark",
    themeHighContrast: "High contrast",
    themeSoft: "Soft",
    densityLabel: "Density",
    densityCompact: "Compact",
    densityComfortable: "Comfortable",
    densityRoomy: "Roomy",
    lensTitle: "Lens preview",
    lensHelp: "Show a local message excerpt on hover.",
    borderTitle: "Viewport border",
    borderHelp: "Draw the current-view outline.",
    debugTitle: "Debug logs",
    debugHelp: "Print detailed startup diagnostics in DevTools.",
    refresh: "Refresh map",
    copyDebug: "Copy debug",
    toggleRail: "Toggle rail",
    openChatGPT: "Open ChatGPT to use the minimap.",
    readyDefault: "Ready on this ChatGPT tab.",
    copied: "Debug info copied.",
    copiedWithError: "Debug info copied with content-script error.",
    copyFailed: "Could not copy debug info.",
    waiting: (assistantCount, retryCount) => `Waiting: 0 user blocks · ${assistantCount} assistant · retry ${retryCount}.`,
    empty: (assistantCount, roleCount) => `Empty: 0 user blocks · ${assistantCount} assistant · ${roleCount} roles.`,
    error: (message) => `Error: ${message || "see DevTools"}`,
    ready: (blocks, roleCount) => `Ready: ${blocks} user block${blocks === 1 ? "" : "s"} · ${roleCount} roles.`
  },
  zh: {
    checking: "正在检查当前标签页...",
    settingsLabel: "Glance 设置",
    enableTitle: "在页面启用",
    enableHelp: "显示 ChatGPT Glance 面板。",
    themeLabel: "配色方案",
    themeAuto: "自动",
    themeLight: "浅色",
    themeDark: "深色",
    themeHighContrast: "高对比度",
    themeSoft: "柔和",
    densityLabel: "密度",
    densityCompact: "紧凑",
    densityComfortable: "舒适",
    densityRoomy: "宽松",
    lensTitle: "Lens 预览",
    lensHelp: "悬停时显示本地消息摘录。",
    borderTitle: "Viewport 边框",
    borderHelp: "显示当前视口描边。",
    debugTitle: "调试日志",
    debugHelp: "在 DevTools 中输出详细启动诊断。",
    refresh: "刷新地图",
    copyDebug: "复制调试",
    toggleRail: "切换侧栏",
    openChatGPT: "打开 ChatGPT 后使用 minimap。",
    readyDefault: "当前 ChatGPT 标签页已就绪。",
    copied: "调试信息已复制。",
    copiedWithError: "已复制包含 content-script 错误的调试信息。",
    copyFailed: "无法复制调试信息。",
    waiting: (assistantCount, retryCount) => `等待中：0 个用户块 · ${assistantCount} 个助手回复 · 重试 ${retryCount}。`,
    empty: (assistantCount, roleCount) => `空状态：0 个用户块 · ${assistantCount} 个助手回复 · ${roleCount} 个角色节点。`,
    error: (message) => `错误：${message || "请查看 DevTools"}`,
    ready: (blocks, roleCount) => `已就绪：${blocks} 个用户块 · ${roleCount} 个角色节点。`
  }
};

const controls = {
  enabled: document.getElementById("enabled"),
  theme: document.getElementById("theme"),
  density: document.getElementById("density"),
  lensEnabled: document.getElementById("lensEnabled"),
  viewportBorder: document.getElementById("viewportBorder"),
  debug: document.getElementById("debug"),
  languageToggle: document.getElementById("languageToggle"),
  refresh: document.getElementById("refresh"),
  copyDebug: document.getElementById("copyDebug"),
  togglePage: document.getElementById("togglePage"),
  settingsPanel: document.getElementById("settingsPanel"),
  statusText: document.getElementById("statusText"),
  statusDot: document.getElementById("statusDot")
};

let currentTabId = null;
let isSupportedPage = false;
let isSaving = false;
let currentLocaleSetting = DEFAULT_SETTINGS.locale;
let lastStatusDetail = null;

function normalizeSettings(input) {
  const raw = { ...DEFAULT_SETTINGS, ...(input || {}) };
  const settings = {
    enabled: Boolean(raw.enabled),
    theme: raw.theme,
    density: raw.density,
    widthMode: "auto",
    lensEnabled: raw.lensEnabled !== false,
    viewportBorder: raw.viewportBorder !== false,
    locale: ["auto", "en", "zh"].includes(raw.locale) ? raw.locale : "auto",
    debug: Boolean(raw.debug)
  };

  if (!["auto", "light", "dark", "highContrast", "soft"].includes(settings.theme)) {
    settings.theme = "auto";
  }

  if (!["compact", "comfortable", "roomy"].includes(settings.density)) {
    settings.density = "comfortable";
  }

  return settings;
}

function readForm() {
  return {
    ...DEFAULT_SETTINGS,
    enabled: controls.enabled.checked,
    theme: controls.theme.value,
    density: controls.density.value,
    widthMode: "auto",
    lensEnabled: controls.lensEnabled.checked,
    viewportBorder: controls.viewportBorder.checked,
    locale: currentLocaleSetting,
    debug: controls.debug.checked
  };
}

function writeForm(settings) {
  currentLocaleSetting = settings.locale;
  controls.enabled.checked = settings.enabled;
  controls.theme.value = settings.theme;
  controls.density.value = settings.density;
  controls.lensEnabled.checked = settings.lensEnabled;
  controls.viewportBorder.checked = settings.viewportBorder;
  controls.debug.checked = settings.debug;
  applyLocale(settings);
}

function resolveLocale(locale = currentLocaleSetting) {
  if (locale === "zh" || locale === "en") {
    return locale;
  }

  return /^zh\b/i.test(navigator.language || "") ? "zh" : "en";
}

function text(key) {
  const locale = resolveLocale();
  return I18N[locale][key] || I18N.en[key] || key;
}

function applyLocale(settings = readForm()) {
  const locale = resolveLocale(settings.locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  controls.languageToggle.textContent = locale === "zh" ? "English" : "中文";
  controls.languageToggle.setAttribute("aria-label", locale === "zh" ? "Switch to English" : "切换到中文");
  controls.settingsPanel.setAttribute("aria-label", text("settingsLabel"));
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = text(key);
  });
  renderStatusText();
}

function setSupportedState(supported, detail) {
  isSupportedPage = supported;
  lastStatusDetail = detail || null;
  controls.statusDot.classList.toggle("ready", supported);
  renderStatusText();

  for (const control of Object.values(controls)) {
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLButtonElement) {
      control.disabled = !supported && control !== controls.languageToggle;
    }
  }
}

function renderStatusText() {
  if (!isSupportedPage && !currentTabId && !lastStatusDetail) {
    controls.statusText.textContent = text("checking");
    return;
  }

  controls.statusText.textContent = isSupportedPage ? formatStatusText(lastStatusDetail) : text("openChatGPT");
}

function formatStatusText(detail) {
  if (!detail) {
    return text("readyDefault");
  }

  const blocks = Number(detail.blockCount || 0);
  const modelStatus = detail.modelStatus || "ready";
  const roleStats = detail.roleStats || {};
  const roleCount = Number(roleStats.roleCount || 0);
  const assistantCount = Number(roleStats.assistantCount || 0);
  const startup = detail.startup || {};
  const ageMs = Number(startup.ageMs || 0);
  const retryCount = Number(startup.retryCount || 0);

  if (modelStatus === "empty") {
    if (ageMs > 0 && ageMs < 10000) {
      return text("waiting")(assistantCount, retryCount);
    }

    return text("empty")(assistantCount, roleCount);
  }

  if (modelStatus === "error") {
    return text("error")(detail.lastError);
  }

  return text("ready")(blocks, roleCount);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function sendToTab(message) {
  if (!currentTabId) {
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(currentTabId, message);
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : "No content script" };
  }
}

async function loadSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const settings = normalizeSettings(result[STORAGE_KEY]);
  writeForm(settings);
  return settings;
}

async function saveSettings() {
  if (isSaving) {
    return;
  }

  isSaving = true;
  const settings = readForm();
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  await sendToTab({ type: "LLMG_SETTINGS_UPDATED", settings });
  isSaving = false;
}

async function refreshStatus() {
  const response = await sendToTab({ type: "LLMG_GET_STATUS" });
  if (response && response.ok) {
    setSupportedState(true, response.status);
    return response.status;
  } else {
    setSupportedState(false);
    return null;
  }
}

async function copyDebugInfo() {
  const response = await sendToTab({ type: "LLMG_GET_STATUS" });
  const payload = {
    copiedAt: new Date().toISOString(),
    tabId: currentTabId,
    response
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    controls.statusText.textContent = response && response.ok
      ? text("copied")
      : text("copiedWithError");
  } catch (error) {
    controls.statusText.textContent = error && error.message ? error.message : text("copyFailed");
  }
}

async function init() {
  await loadSettings();
  const tab = await getActiveTab();
  currentTabId = tab && tab.id ? tab.id : null;
  await refreshStatus();

  const inputs = [
    controls.enabled,
    controls.theme,
    controls.density,
    controls.lensEnabled,
    controls.viewportBorder,
    controls.debug
  ];

  for (const input of inputs) {
    input.addEventListener("change", saveSettings);
  }

  controls.languageToggle.addEventListener("click", async () => {
    const settings = readForm();
    settings.locale = resolveLocale(settings.locale) === "zh" ? "en" : "zh";
    currentLocaleSetting = settings.locale;
    writeForm(normalizeSettings(settings));
    await saveSettings();
  });

  controls.refresh.addEventListener("click", async () => {
    await sendToTab({ type: "LLMG_REFRESH_MODEL" });
    await refreshStatus();
  });

  controls.copyDebug.addEventListener("click", copyDebugInfo);

  controls.togglePage.addEventListener("click", async () => {
    const response = await sendToTab({ type: "LLMG_TOGGLE" });
    if (response && response.ok) {
      writeForm(normalizeSettings(response.settings));
      await refreshStatus();
    }
  });
}

init();
