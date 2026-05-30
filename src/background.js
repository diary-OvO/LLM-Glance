"use strict";

const LLMG_STORAGE_KEY = "llmgSettings";

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

function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]);
}

async function ensureDefaults() {
  const result = await chrome.storage.local.get(LLMG_STORAGE_KEY);
  if (!result[LLMG_STORAGE_KEY]) {
    await chrome.storage.local.set({ [LLMG_STORAGE_KEY]: DEFAULT_SETTINGS });
  }
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : "No content script" };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-glance") {
    sendToActiveTab({ type: "LLMG_TOGGLE" });
  }
});
