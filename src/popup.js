"use strict";

const STORAGE_KEY = "llmgSettings";

const DEFAULT_SETTINGS = {
  enabled: true,
  theme: "dark",
  density: "comfortable",
  widthMode: "auto",
  debug: false
};

const controls = {
  enabled: document.getElementById("enabled"),
  theme: document.getElementById("theme"),
  density: document.getElementById("density"),
  debug: document.getElementById("debug"),
  refresh: document.getElementById("refresh"),
  copyDebug: document.getElementById("copyDebug"),
  togglePage: document.getElementById("togglePage"),
  statusText: document.getElementById("statusText"),
  statusDot: document.getElementById("statusDot")
};

let currentTabId = null;
let isSupportedPage = false;
let isSaving = false;

function normalizeSettings(input) {
  const raw = { ...DEFAULT_SETTINGS, ...(input || {}) };
  return {
    enabled: Boolean(raw.enabled),
    theme: raw.theme,
    density: raw.density,
    widthMode: "auto",
    debug: Boolean(raw.debug)
  };
}

function readForm() {
  return {
    ...DEFAULT_SETTINGS,
    enabled: controls.enabled.checked,
    theme: controls.theme.value,
    density: controls.density.value,
    widthMode: "auto",
    debug: controls.debug.checked
  };
}

function writeForm(settings) {
  controls.enabled.checked = settings.enabled;
  controls.theme.value = settings.theme;
  controls.density.value = settings.density;
  controls.debug.checked = settings.debug;
}

function setSupportedState(supported, detail) {
  isSupportedPage = supported;
  controls.statusDot.classList.toggle("ready", supported);
  controls.statusText.textContent = supported ? formatStatusText(detail) : "Open ChatGPT to use the minimap.";

  for (const control of Object.values(controls)) {
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLButtonElement) {
      control.disabled = !supported && control !== controls.statusText && control !== controls.statusDot;
    }
  }
}

function formatStatusText(detail) {
  if (!detail) {
    return "Ready on this ChatGPT tab.";
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
      return `Waiting: 0 user blocks · ${assistantCount} assistant · retry ${retryCount}.`;
    }

    return `Empty: 0 user blocks · ${assistantCount} assistant · ${roleCount} roles.`;
  }

  if (modelStatus === "error") {
    return `Error: ${detail.lastError || "see DevTools"}`;
  }

  return `Ready: ${blocks} user block${blocks === 1 ? "" : "s"} · ${roleCount} roles.`;
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
      ? "Debug info copied."
      : "Debug info copied with content-script error.";
  } catch (error) {
    controls.statusText.textContent = error && error.message ? error.message : "Could not copy debug info.";
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
    controls.debug
  ];

  for (const input of inputs) {
    input.addEventListener("change", saveSettings);
  }

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
