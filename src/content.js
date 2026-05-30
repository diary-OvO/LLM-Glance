"use strict";

(() => {
  const ROOT_ID = "llm-glance-root";
  const STORAGE_KEY = "llmgSettings";
  const PREVIEW_ATTR = "data-llm-glance-preview";
  const MESSAGE = {
    TOGGLE: "LLMG_TOGGLE",
    GET_STATUS: "LLMG_GET_STATUS",
    SETTINGS_UPDATED: "LLMG_SETTINGS_UPDATED",
    REFRESH_MODEL: "LLMG_REFRESH_MODEL"
  };

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

  const DENSITY_WIDTH = {
    compact: 76,
    comfortable: 96,
    roomy: 122
  };

  const VIEWPORT_FIXED_HEIGHT = 120;

  const THEMES = {
    light: {
      panel: "rgba(248, 250, 255, 0.55)",
      panelTop: "rgba(255, 255, 255, 0.72)",
      panelGlow: "rgba(13, 148, 136, 0.12)",
      line: "rgba(216, 222, 233, 0.78)",
      lineSoft: "rgba(39, 51, 75, 0.06)",
      text: "#172033",
      muted: "#697386",
      user: "#0d9488",
      userSoft: "rgba(13, 148, 136, 0.22)",
      viewport: "rgba(13, 148, 136, 0.14)",
      viewportActive: "rgba(13, 148, 136, 0.30)",
      viewportBorder: "rgba(13, 148, 136, 0.72)",
      handle: "rgba(13, 148, 136, 0.22)",
      shadow: "-12px 0 32px rgba(23, 32, 51, 0.10), inset 1px 0 0 rgba(255, 255, 255, 0.55)"
    },
    dark: {
      panel: "rgba(18, 20, 26, 0.58)",
      panelTop: "rgba(34, 38, 46, 0.70)",
      panelGlow: "rgba(94, 234, 212, 0.12)",
      line: "rgba(61, 65, 75, 0.80)",
      lineSoft: "rgba(255, 255, 255, 0.06)",
      text: "#d9dce3",
      muted: "#8b93a3",
      user: "#5eead4",
      userSoft: "rgba(94, 234, 212, 0.24)",
      viewport: "rgba(94, 234, 212, 0.14)",
      viewportActive: "rgba(94, 234, 212, 0.28)",
      viewportBorder: "rgba(94, 234, 212, 0.85)",
      handle: "rgba(94, 234, 212, 0.22)",
      shadow: "-12px 0 32px rgba(0, 0, 0, 0.32), inset 1px 0 0 rgba(255, 255, 255, 0.04)"
    },
    highContrast: {
      panel: "rgba(0, 0, 0, 0.92)",
      panelTop: "rgba(0, 0, 0, 0.92)",
      panelGlow: "rgba(0, 162, 255, 0.20)",
      line: "#ffffff",
      lineSoft: "rgba(255, 255, 255, 0.18)",
      text: "#ffffff",
      muted: "#ffffff",
      user: "#00a2ff",
      userSoft: "rgba(0, 162, 255, 0.42)",
      viewport: "rgba(255, 255, 255, 0.28)",
      viewportActive: "rgba(255, 255, 255, 0.46)",
      viewportBorder: "#ffffff",
      handle: "rgba(255, 255, 255, 0.32)",
      shadow: "-8px 0 0 rgba(0, 0, 0, 0.6)"
    },
    soft: {
      panel: "rgba(251, 248, 240, 0.58)",
      panelTop: "rgba(255, 253, 246, 0.74)",
      panelGlow: "rgba(20, 184, 166, 0.10)",
      line: "rgba(216, 214, 203, 0.78)",
      lineSoft: "rgba(31, 41, 55, 0.06)",
      text: "#1f2937",
      muted: "#6b7280",
      user: "#14b8a6",
      userSoft: "rgba(20, 184, 166, 0.22)",
      viewport: "rgba(20, 184, 166, 0.14)",
      viewportActive: "rgba(20, 184, 166, 0.28)",
      viewportBorder: "rgba(20, 184, 166, 0.68)",
      handle: "rgba(20, 184, 166, 0.22)",
      shadow: "-12px 0 32px rgba(31, 41, 55, 0.10), inset 1px 0 0 rgba(255, 255, 255, 0.55)"
    }
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function debounce(fn, wait) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  }

  function safeErrorMessage(error) {
    if (!error) {
      return "";
    }

    return error && error.message ? error.message : String(error);
  }

  function describeElement(element) {
    if (!element) {
      return "none";
    }

    if (isDocumentScroller(element)) {
      return "document";
    }

    if (!(element instanceof Element)) {
      return "unknown";
    }

    const tag = element.tagName ? element.tagName.toLowerCase() : "element";
    const id = element.id ? `#${element.id}` : "";
    const classes = `${element.className || ""}`
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(".");
    return `${tag}${id}${classes ? `.${classes}` : ""}`.slice(0, 160);
  }

  function collectRoleStats() {
    const stats = {
      roleCount: 0,
      userCount: 0,
      assistantCount: 0,
      otherRoleCount: 0
    };

    document.querySelectorAll("[data-message-author-role]").forEach((node) => {
      stats.roleCount += 1;
      const role = node.getAttribute("data-message-author-role");
      if (role === "user") {
        stats.userCount += 1;
        return;
      }

      if (role === "assistant") {
        stats.assistantCount += 1;
        return;
      }

      stats.otherRoleCount += 1;
    });

    return stats;
  }

  function getScrollTargetInfo(target) {
    return {
      target: describeElement(target),
      isDocument: isDocumentScroller(target),
      scrollTop: Math.round(getScrollTop(target)),
      clientHeight: Math.round(getClientHeight(target)),
      scrollHeight: Math.round(getScrollHeight(target))
    };
  }

  class DebugLogger {
    constructor() {
      this.debug = DEFAULT_SETTINGS.debug;
      this.bootGroupOpen = false;
      this.loggedOnce = new Set();
      this.onceEvents = new Set([
        "message_scan_done",
        "model_ready",
        "model_empty"
      ]);
      this.alwaysEvents = new Set([
        "script_loaded",
        "boot_skipped",
        "adapter_matched",
        "adapter_unmatched",
        "settings_loaded",
        "shell_mounted",
        "scroll_container_detected",
        "message_scan_done",
        "model_ready",
        "model_empty",
        "model_error",
        "boot_error"
      ]);
    }

    setSettings(settings) {
      this.debug = Boolean(settings && settings.debug);
    }

    startBootGroup(payload) {
      if (console.groupCollapsed) {
        console.groupCollapsed("[LLM Glance] boot");
        this.bootGroupOpen = true;
      }
      this.log("script_loaded", payload, "info", true);
    }

    endBootGroup() {
      if (this.bootGroupOpen && console.groupEnd) {
        console.groupEnd();
      }
      this.bootGroupOpen = false;
    }

    log(event, payload, level, force) {
      if (!force && !this.debug && !this.alwaysEvents.has(event)) {
        return;
      }

      if (!this.debug && this.onceEvents.has(event)) {
        const statusKey = payload && payload.modelStatus ? `${event}:${payload.modelStatus}` : event;
        if (this.loggedOnce.has(statusKey)) {
          return;
        }
        this.loggedOnce.add(statusKey);
      }

      const method = typeof console[level] === "function" ? level : "log";
      console[method](`[LLM Glance] ${event}${this.formatSummary(payload)}`, {
        event,
        time: new Date().toISOString(),
        url: window.location.href,
        host: window.location.hostname,
        readyState: document.readyState,
        ...(payload || {})
      });
    }

    formatSummary(payload) {
      if (!payload || !payload.modelStatus) {
        return "";
      }

      const roleStats = payload.roleStats || {};
      const panel = payload.panel || {};
      const scrollTarget = payload.scrollTarget || {};
      return ` status=${payload.modelStatus} blocks=${payload.blockCount || 0} roles=${roleStats.roleCount || 0} users=${roleStats.userCount || 0} assistants=${roleStats.assistantCount || 0} scroll=${scrollTarget.target || "unknown"} panel=${panel.width || 0}x${panel.drawHeight || 0}`;
    }

    debugEvent(event, payload) {
      this.log(event, payload, "debug", false);
    }

    error(event, error, payload) {
      this.log(event, {
        ...(payload || {}),
        error: safeErrorMessage(error),
        stack: this.debug && error && error.stack ? error.stack : undefined
      }, "error", true);
    }
  }

  const logger = new DebugLogger();

  logger.startBootGroup({
    isTopFrame: window.top === window.self,
    hasExistingRoot: Boolean(document.getElementById(ROOT_ID))
  });

  if (window.top !== window.self) {
    logger.log("boot_skipped", { reason: "iframe" }, "info", true);
    logger.endBootGroup();
    return;
  }

  if (document.getElementById(ROOT_ID)) {
    logger.log("boot_skipped", { reason: "duplicate_root" }, "info", true);
    logger.endBootGroup();
    return;
  }

  function extensionApiReady() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.runtime;
  }

  function normalizeSettings(input) {
    const raw = { ...DEFAULT_SETTINGS, ...(input || {}) };
    const settings = {
      enabled: Boolean(raw.enabled),
      theme: raw.theme,
      density: raw.density,
      widthMode: "auto",
      lensEnabled: raw.lensEnabled !== false,
      viewportBorder: raw.viewportBorder !== false,
      locale: raw.locale,
      debug: Boolean(raw.debug)
    };

    if (!THEMES[settings.theme] && settings.theme !== "auto") {
      settings.theme = "auto";
    }

    if (!DENSITY_WIDTH[settings.density]) {
      settings.density = "comfortable";
    }

    if (!["auto", "en", "zh"].includes(settings.locale)) {
      settings.locale = "auto";
    }

    return settings;
  }

  function getFromStorage() {
    if (!extensionApiReady()) {
      return Promise.resolve(DEFAULT_SETTINGS);
    }

    return chrome.storage.local.get(STORAGE_KEY)
      .then((result) => normalizeSettings(result && result[STORAGE_KEY]))
      .catch(() => DEFAULT_SETTINGS);
  }

  function setToStorage(settings) {
    if (!extensionApiReady()) {
      return Promise.resolve();
    }

    return chrome.storage.local.set({ [STORAGE_KEY]: normalizeSettings(settings) });
  }

  function isDocumentScroller(node) {
    return node === window
      || node === document
      || node === document.documentElement
      || node === document.body
      || node === document.scrollingElement;
  }

  function getScrollTop(target) {
    if (isDocumentScroller(target)) {
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    return target.scrollTop;
  }

  function getClientHeight(target) {
    if (isDocumentScroller(target)) {
      return window.innerHeight || document.documentElement.clientHeight;
    }

    return target.clientHeight;
  }

  function getScrollHeight(target) {
    if (isDocumentScroller(target)) {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
        document.documentElement.clientHeight
      );
    }

    return target.scrollHeight;
  }

  function scrollToPosition(target, top, smooth) {
    const nextTop = clamp(top, 0, Math.max(0, getScrollHeight(target) - getClientHeight(target)));
    const behavior = smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto";

    if (isDocumentScroller(target)) {
      window.scrollTo({ top: nextTop, behavior });
      return;
    }

    target.scrollTo({ top: nextTop, behavior });
  }

  function getScrollDelta(target) {
    return Math.max(0, getScrollHeight(target) - getClientHeight(target));
  }

  function hasScrollableOverflow(element) {
    if (!element || isDocumentScroller(element) || !(element instanceof Element)) {
      return true;
    }

    const style = window.getComputedStyle(element);
    return /(auto|scroll|overlay)/.test(`${style.overflowY} ${style.overflow}`);
  }

  function getScrollCandidateScore(candidate) {
    const delta = getScrollDelta(candidate);
    if (delta <= 200) {
      return -1;
    }

    if (isDocumentScroller(candidate)) {
      return delta + 12000 + (getScrollTop(candidate) > 0 ? 18000 : 0);
    }

    if (!(candidate instanceof Element) || !hasScrollableOverflow(candidate)) {
      return -1;
    }

    const rect = candidate.getBoundingClientRect();
    if (rect.height < 160 || rect.width < 240) {
      return -1;
    }

    const className = `${candidate.className || ""}`;
    const preferred = candidate.matches("[data-radix-scroll-area-viewport]")
      || className.includes("overflow-y-auto")
      || className.includes("overflow-auto");
    return delta
      + (preferred ? 45000 : 0)
      + (getScrollTop(candidate) > 0 ? 18000 : 0)
      + Math.round(Math.min(rect.height, window.innerHeight));
  }

  function findScrollContainer() {
    const explicitScrollTarget = document.querySelector("[data-llm-glance-scroll]");
    if (explicitScrollTarget) {
      return explicitScrollTarget;
    }

    const foundCandidates = [
      ...document.querySelectorAll('[data-radix-scroll-area-viewport], [class*="overflow-y-auto"], [class*="overflow-auto"]')
    ];
    const candidates = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      ...foundCandidates,
      document.querySelector("main"),
      document.querySelector('[role="main"]')
    ].filter(Boolean);

    let best = document.scrollingElement || document.documentElement;
    let bestScore = getScrollCandidateScore(best);

    for (const candidate of candidates) {
      const score = getScrollCandidateScore(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    logger.debugEvent("scroll_candidates_scored", {
      selected: describeElement(best),
      selectedScore: bestScore,
      candidates: candidates.slice(0, 12).map((candidate) => ({
        target: describeElement(candidate),
        score: getScrollCandidateScore(candidate),
        scrollTop: Math.round(getScrollTop(candidate)),
        clientHeight: Math.round(getClientHeight(candidate)),
        scrollHeight: Math.round(getScrollHeight(candidate)),
        overflow: candidate instanceof Element && !isDocumentScroller(candidate)
          ? `${getComputedStyle(candidate).overflowY}/${getComputedStyle(candidate).overflow}`
          : "document"
      }))
    });

    return best;
  }

  function getRelativeBox(element, scrollTarget) {
    const rect = element.getBoundingClientRect();

    if (isDocumentScroller(scrollTarget)) {
      return {
        top: rect.top + getScrollTop(scrollTarget),
        height: Math.max(rect.height, 24)
      };
    }

    const containerRect = scrollTarget.getBoundingClientRect();
    return {
      top: rect.top - containerRect.top + getScrollTop(scrollTarget),
      height: Math.max(rect.height, 24)
    };
  }

  function isVisibleElement(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  class ChatGPTAdapter {
    constructor() {
      this.observer = null;
      this.lastScan = {
        ...collectRoleStats(),
        messageNodeCount: 0,
        userBlockCount: 0
      };
    }

    match() {
      return document.documentElement.hasAttribute(PREVIEW_ATTR)
        || /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/.test(window.location.hostname);
    }

    getScrollContainer() {
      return findScrollContainer();
    }

    getUserMessages(scrollTarget) {
      const nodes = this.findMessageNodes();
      const scrollHeight = Math.max(1, getScrollHeight(scrollTarget));

      const blocks = nodes.map((node, index) => {
        if (this.extractRole(node, index) !== "user") {
          return null;
        }

        const text = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (!text) {
          return null;
        }

        const box = getRelativeBox(node, scrollTarget);
        return {
          id: `llmg-user-${index}-${Math.round(box.top)}`,
          element: node,
          top: box.top,
          height: box.height,
          ratioStart: clamp(box.top / scrollHeight, 0, 1),
          ratioEnd: clamp((box.top + box.height) / scrollHeight, 0, 1)
        };
      }).filter(Boolean);

      this.lastScan = {
        ...collectRoleStats(),
        messageNodeCount: nodes.length,
        userBlockCount: blocks.length
      };

      return blocks;
    }

    getConversationContentHeight(scrollTarget) {
      const scrollHeight = Math.max(1, getScrollHeight(scrollTarget));
      const visibleHeight = Math.max(1, getClientHeight(scrollTarget));
      if (scrollHeight > visibleHeight + 1) {
        return scrollHeight;
      }

      const nodes = this.findMessageNodes();
      let contentBottom = 0;
      for (const node of nodes) {
        const box = getRelativeBox(node, scrollTarget);
        contentBottom = Math.max(contentBottom, box.top + box.height);
      }

      return Math.max(1, contentBottom || scrollHeight);
    }

    getMessagePreviews(scrollTarget) {
      return this.findMessageNodes().map((node, index) => {
        const box = getRelativeBox(node, scrollTarget);
        return {
          id: `llmg-message-${index}-${Math.round(box.top)}`,
          index: index + 1,
          role: this.extractRole(node, index),
          element: node,
          text: (node.textContent || "").replace(/\s+/g, " ").trim(),
          top: box.top,
          height: box.height
        };
      }).filter((block) => block.text);
    }

    getDebugStats() {
      return {
        ...this.lastScan
      };
    }

    findMessageNodes() {
      const ordered = [];
      const seen = new Set();

      const add = (node) => {
        if (!node || seen.has(node) || !isVisibleElement(node)) {
          return;
        }

        const text = (node.textContent || "").trim();
        if (text.length < 2) {
          return;
        }

        seen.add(node);
        ordered.push(node);
      };

      document.querySelectorAll('[data-testid^="conversation-turn-"]').forEach(add);

      if (ordered.length < 2) {
        document.querySelectorAll("[data-message-author-role]").forEach((node) => {
          add(node.closest('[data-testid^="conversation-turn-"]') || node.closest("article") || node);
        });
      }

      if (ordered.length < 2) {
        document.querySelectorAll("main article").forEach(add);
      }

      return ordered.sort((a, b) => {
        if (a === b) {
          return 0;
        }

        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
      });
    }

    extractRole(node, index) {
      const roleNode = node.matches("[data-message-author-role]")
        ? node
        : node.querySelector("[data-message-author-role]");
      const role = roleNode ? roleNode.getAttribute("data-message-author-role") : "";

      if (role === "user" || role === "assistant") {
        return role;
      }

      const testId = `${node.getAttribute("data-testid") || ""} ${(node.querySelector("[data-testid]") || {}).dataset?.testid || ""}`.toLowerCase();
      if (testId.includes("user")) {
        return "user";
      }

      if (testId.includes("assistant")) {
        return "assistant";
      }

      return index % 2 === 0 ? "user" : "assistant";
    }

    observe(onChange) {
      const target = document.querySelector("main") || document.body;
      const handler = debounce(onChange, 220);
      this.observer = new MutationObserver(handler);
      this.observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true
      });
      return () => this.disconnect();
    }

    disconnect() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }
  }

  class LLMGlancePanel {
    constructor(adapter, settings) {
      this.adapter = adapter;
      this.settings = normalizeSettings(settings);
      this.userBlocks = [];
      this.messageBlocks = [];
      this.scrollTarget = document.scrollingElement || document.documentElement;
      this.host = null;
      this.shadow = null;
      this.canvas = null;
      this.viewport = null;
      this.messageLens = null;
      this.lensTitle = null;
      this.lensText = null;
      this.panel = null;
      this.resizeHandle = null;
      this.contextTheme = THEMES.dark;
      this.panelWidth = DENSITY_WIDTH.comfortable;
      this.customWidth = 0;
      this.scale = 0.08;
      this.documentHeight = 1;
      this.drawHeight = 1;
      this.visibleStart = 0;
      this.visibleEnd = 1;
      this.viewportStart = 0;
      this.viewportHeight = 1;
      this.draggingViewport = false;
      this.resizing = false;
      this.dragStartY = 0;
      this.dragStartDelta = 0;
      this.resizeStartX = 0;
      this.resizeStartWidth = 0;
      this.activeLensBlockId = "";
      this.scrollRaf = 0;
      this.resizeRaf = 0;
      this.refreshTimer = 0;
      this.startupRetryTimers = [];
      this.startupRetryCount = 0;
      this.mountedAt = performance.now();
      this.scrollListenerTarget = null;
      this.layoutReservation = null;
      this.modelStatus = "initializing";
      this.lastError = "";
      this.scanStats = {
        roleCount: 0,
        userCount: 0,
        assistantCount: 0,
        otherRoleCount: 0,
        messageNodeCount: 0,
        userBlockCount: 0
      };
      this.onScroll = () => this.scheduleDraw();
    }

    mount() {
      this.host = document.createElement("llm-glance-panel");
      this.host.id = ROOT_ID;
      this.shadow = this.host.attachShadow({ mode: "open" });
      this.shadow.innerHTML = this.renderShell();
      document.documentElement.appendChild(this.host);

      this.canvas = this.shadow.querySelector("canvas");
      this.viewport = this.shadow.querySelector(".viewport");
      this.messageLens = this.shadow.querySelector(".message-lens");
      this.lensTitle = this.shadow.querySelector(".lens-title");
      this.lensText = this.shadow.querySelector(".lens-text");
      this.panel = this.shadow.querySelector(".glance-panel");
      this.resizeHandle = this.shadow.querySelector(".resize-handle");

      this.bindEvents();
      this.scrollTarget = this.adapter.getScrollContainer();
      logger.log("scroll_container_detected", {
        scrollTarget: getScrollTargetInfo(this.scrollTarget)
      }, "info");
      this.applySettings(this.settings, false);
      logger.log("shell_mounted", this.getStatusSnapshot(), "info");
      this.adapter.observe(() => this.scheduleRefresh(120));
      this.scheduleStartupRetries();
      this.scheduleRefresh(0);
    }

    renderShell() {
      return `
        <style>
          :host {
            --llmg-width: 96px;
            --llmg-top: 0px;
            --llmg-left: auto;
            --llmg-right: 0px;
            --llmg-bottom: 0px;
            all: initial;
            position: fixed;
            top: var(--llmg-top);
            right: var(--llmg-right);
            bottom: var(--llmg-bottom);
            left: var(--llmg-left);
            width: var(--llmg-width);
            z-index: 2147483600;
            color-scheme: dark;
            font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            transition: bottom 320ms cubic-bezier(0.22, 0.61, 0.36, 1);
          }

          @media (prefers-reduced-motion: reduce) {
            :host {
              transition: none;
            }
          }

          .glance-panel {
            position: absolute;
            inset: 0;
            min-width: 0;
            overflow: hidden;
            border-left: 1px solid var(--llmg-line);
            background: transparent;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            box-shadow: none;
            cursor: pointer;
            touch-action: none;
            user-select: none;
          }

          canvas {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            image-rendering: pixelated;
            mix-blend-mode: normal;
          }

          .viewport {
            position: absolute;
            left: 4px;
            right: 4px;
            top: 0;
            min-height: 2px;
            background: var(--llmg-viewport);
            border-radius: 6px;
            pointer-events: none;
            box-shadow: inset 0 0 0 1px transparent;
            backdrop-filter: blur(6px) saturate(1.2) brightness(1.05);
            -webkit-backdrop-filter: blur(6px) saturate(1.2) brightness(1.05);
            transition: background 140ms ease, box-shadow 140ms ease;
          }

          .viewport.with-border {
            box-shadow: inset 0 0 0 1px var(--llmg-viewport-border);
          }

          .glance-panel:hover .viewport {
            background: var(--llmg-viewport-active);
          }

          .glance-panel.dragging .viewport {
            background: var(--llmg-viewport-active);
            box-shadow: inset 0 0 0 1px var(--llmg-viewport-border);
          }

          .resize-handle {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            width: 7px;
            cursor: ew-resize;
            background: linear-gradient(90deg, var(--llmg-handle), transparent);
            opacity: 0;
            transition: opacity 120ms ease;
          }

          .glance-panel:hover .resize-handle,
          .resize-handle.active {
            opacity: 1;
          }

          .glance-panel:focus-visible {
            outline: 2px solid var(--llmg-viewport-border);
            outline-offset: -2px;
          }

          .message-lens {
            position: fixed;
            z-index: 2147483601;
            width: min(360px, calc(100vw - 32px));
            max-height: 220px;
            overflow: hidden;
            border: 1px solid var(--llmg-line);
            border-radius: 8px;
            background: rgba(18, 20, 26, 0.94);
            color: #f3f6fb;
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
            opacity: 0;
            pointer-events: none;
            transform: translateY(4px);
            transition: opacity 90ms ease, transform 90ms ease;
          }

          .message-lens.visible {
            opacity: 1;
            transform: translateY(0);
          }

          .lens-title {
            height: 28px;
            display: flex;
            align-items: center;
            padding: 0 10px;
            border-bottom: 1px solid var(--llmg-line);
            color: var(--llmg-muted);
            background: rgba(255, 255, 255, 0.06);
            font-size: 12px;
            font-weight: 600;
          }

          .lens-text {
            margin: 0;
            padding: 10px;
            color: #f3f6fb;
            font: 12px/1.55 "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
          }
        </style>

        <aside class="glance-panel" tabindex="0" aria-label="LLM Glance user chat minimap">
          <canvas></canvas>
          <div class="viewport with-border" aria-hidden="true"></div>
          <div class="resize-handle" aria-hidden="true"></div>
        </aside>
        <div class="message-lens" role="tooltip" aria-hidden="true">
          <div class="lens-title"></div>
          <p class="lens-text"></p>
        </div>
      `;
    }

    bindEvents() {
      this.panel.addEventListener("pointerdown", (event) => this.handlePanelDown(event));
      this.panel.addEventListener("pointermove", (event) => this.handlePanelMove(event));
      this.panel.addEventListener("pointerleave", () => this.hideLens());
      this.panel.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
      this.panel.addEventListener("keydown", (event) => this.handleKeydown(event));
      window.addEventListener("pointermove", (event) => this.handleWindowMove(event), true);
      window.addEventListener("pointerup", () => this.handleWindowUp(), true);
      window.addEventListener("resize", () => this.scheduleResize(), { passive: true });

      if (extensionApiReady()) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          this.handleMessage(message).then(sendResponse);
          return true;
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName === "local" && changes[STORAGE_KEY] && changes[STORAGE_KEY].newValue) {
            this.applySettings(changes[STORAGE_KEY].newValue, false);
          }
        });
      }
    }

    async handleMessage(message) {
      if (!message || !message.type) {
        return { ok: false, reason: "Unknown message" };
      }

      if (message.type === MESSAGE.GET_STATUS) {
        return {
          ok: true,
          status: this.getStatusSnapshot()
        };
      }

      if (message.type === MESSAGE.TOGGLE) {
        this.settings = normalizeSettings({ ...this.settings, enabled: !this.settings.enabled });
        await setToStorage(this.settings);
        this.applySettings(this.settings, false);
        return { ok: true, settings: this.settings };
      }

      if (message.type === MESSAGE.SETTINGS_UPDATED) {
        this.applySettings(message.settings, false);
        return { ok: true, settings: this.settings };
      }

      if (message.type === MESSAGE.REFRESH_MODEL) {
        this.refreshModel();
        return { ok: true, status: this.getStatusSnapshot() };
      }

      return { ok: false, reason: "Unsupported message" };
    }

    applySettings(input, persist) {
      this.settings = normalizeSettings(input);
      logger.setSettings(this.settings);
      this.host.style.display = this.settings.enabled ? "" : "none";
      if (!this.settings.enabled) {
        this.modelStatus = "disabled";
        this.hideLens();
        this.clearLayoutReservation();
        this.syncDebugAttributes();
        if (persist) {
          setToStorage(this.settings);
        }
        return;
      }
      this.updateTheme();
      this.syncViewportBorder();
      if (!this.settings.lensEnabled) {
        this.hideLens();
      }
      this.updateDimensions();

      if (persist) {
        setToStorage(this.settings);
      }

      if (this.settings.enabled) {
        this.scheduleRefresh(0);
      }
    }

    updateTheme() {
      const themeName = this.settings.theme === "auto"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : this.settings.theme;
      this.contextTheme = THEMES[themeName] || THEMES.dark;

      const root = this.host.style;
      root.setProperty("--llmg-panel", this.contextTheme.panel);
      root.setProperty("--llmg-panel-top", this.contextTheme.panelTop);
      root.setProperty("--llmg-panel-glow", this.contextTheme.panelGlow);
      root.setProperty("--llmg-line", this.contextTheme.line);
      root.setProperty("--llmg-line-soft", this.contextTheme.lineSoft);
      root.setProperty("--llmg-text", this.contextTheme.text);
      root.setProperty("--llmg-muted", this.contextTheme.muted);
      root.setProperty("--llmg-user", this.contextTheme.user);
      root.setProperty("--llmg-user-soft", this.contextTheme.userSoft);
      root.setProperty("--llmg-viewport", this.contextTheme.viewport);
      root.setProperty("--llmg-viewport-active", this.contextTheme.viewportActive);
      root.setProperty("--llmg-viewport-border", this.contextTheme.viewportBorder);
      root.setProperty("--llmg-handle", this.contextTheme.handle);
      root.setProperty("--llmg-shadow", this.contextTheme.shadow);
    }

    syncViewportBorder() {
      if (this.viewport) {
        this.viewport.classList.toggle("with-border", this.settings.viewportBorder);
      }
    }

    scheduleRefresh(delay) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => this.refreshModel(), delay);
    }

    scheduleStartupRetries() {
      const retryDelays = [350, 900, 1800, 3600, 6500, 9500];
      this.startupRetryTimers = retryDelays.map((delay) => {
        return window.setTimeout(() => {
          if (!this.settings.enabled || this.userBlocks.length > 0) {
            return;
          }

          this.startupRetryCount += 1;
          logger.debugEvent("startup_retry", {
            retryCount: this.startupRetryCount,
            delay,
            roleStats: collectRoleStats()
          });
          this.refreshModel();
        }, delay);
      });
    }

    refreshModel() {
      try {
        this.scrollTarget = this.adapter.getScrollContainer();
        logger.debugEvent("scroll_container_detected", {
          scrollTarget: getScrollTargetInfo(this.scrollTarget)
        });
        this.updateScrollListener();
        this.userBlocks = this.adapter.getUserMessages(this.scrollTarget);
        this.messageBlocks = this.adapter.getMessagePreviews
          ? this.adapter.getMessagePreviews(this.scrollTarget)
          : [];
        this.scanStats = this.adapter.getDebugStats();
        this.modelStatus = this.userBlocks.length ? "ready" : "empty";
        this.lastError = "";
        this.syncDebugAttributes();
        this.updateDimensions();
        this.draw();
        const snapshot = this.getStatusSnapshot();
        logger.log("message_scan_done", snapshot, "info");
        logger.log(this.modelStatus === "ready" ? "model_ready" : "model_empty", snapshot, "info");
      } catch (error) {
        this.modelStatus = "error";
        this.lastError = safeErrorMessage(error);
        this.syncDebugAttributes();
        logger.error("model_error", error, this.getStatusSnapshot());
      }
    }

    updateScrollListener() {
      const nextTarget = isDocumentScroller(this.scrollTarget) ? window : this.scrollTarget;
      if (this.scrollListenerTarget === nextTarget) {
        return;
      }

      if (this.scrollListenerTarget) {
        this.scrollListenerTarget.removeEventListener("scroll", this.onScroll);
      }

      this.scrollListenerTarget = nextTarget;
      this.scrollListenerTarget.addEventListener("scroll", this.onScroll, { passive: true });
    }

    scheduleResize() {
      if (this.resizeRaf) {
        return;
      }

      this.resizeRaf = window.requestAnimationFrame(() => {
        this.resizeRaf = 0;
        this.updateDimensions();
        this.draw();
      });
    }

    scheduleDraw() {
      if (this.scrollRaf) {
        return;
      }

      this.scrollRaf = window.requestAnimationFrame(() => {
        this.scrollRaf = 0;
        this.draw();
      });
    }

    updateDimensions() {
      this.panelWidth = this.customWidth || this.calculateWidth();
      const bounds = this.calculatePanelBounds(this.panelWidth);
      this.reserveLayoutSpace(this.panelWidth, bounds);
      this.host.style.setProperty("--llmg-width", `${this.panelWidth}px`);
      this.host.style.setProperty("--llmg-top", `${bounds.top}px`);
      this.host.style.setProperty("--llmg-bottom", `${bounds.bottom}px`);
      this.host.style.setProperty("--llmg-left", bounds.left === null ? "auto" : `${bounds.left}px`);
      this.host.style.setProperty("--llmg-right", bounds.right === null ? "auto" : `${bounds.right}px`);
      this.syncDebugAttributes();
    }

    syncDebugAttributes() {
      if (!this.host) {
        return;
      }

      const snapshot = this.getStatusSnapshot();
      this.host.dataset.llmgRenderMode = "user-only";
      this.host.dataset.llmgStatus = snapshot.modelStatus;
      this.host.dataset.llmgLastError = snapshot.lastError;
      this.host.dataset.llmgUserBlockCount = String(snapshot.blockCount);
      this.host.dataset.llmgRoleCount = String(snapshot.roleStats.roleCount);
      this.host.dataset.llmgUserRoleCount = String(snapshot.roleStats.userCount);
      this.host.dataset.llmgAssistantRoleCount = String(snapshot.roleStats.assistantCount);
      this.host.dataset.llmgPanelWidth = String(Math.round(this.panelWidth));
      this.host.dataset.llmgScrollHeight = String(snapshot.scrollTarget.scrollHeight);
      this.host.dataset.llmgViewportHeight = String(Math.round(this.viewportHeight));
      this.host.dataset.llmgScrollTarget = snapshot.scrollTarget.target;
    }

    getStatusSnapshot() {
      const scrollTarget = getScrollTargetInfo(this.scrollTarget);
      return {
        enabled: this.settings.enabled,
        host: window.location.hostname,
        url: window.location.href,
        modelStatus: this.modelStatus,
        renderMode: "user-only",
        blockCount: this.userBlocks.length,
        lastError: this.lastError,
        settings: this.settings,
        roleStats: {
          ...this.scanStats,
          userBlockCount: this.userBlocks.length
        },
        scrollTarget,
        startup: {
          ageMs: Math.round(performance.now() - this.mountedAt),
          retryCount: this.startupRetryCount
        },
        panel: {
          width: Math.round(this.panelWidth),
          viewportHeight: Math.round(this.viewportHeight),
          documentHeight: Math.round(this.documentHeight),
          drawHeight: Math.round(this.drawHeight),
          visibleStart: Math.round(this.visibleStart),
          visibleEnd: Math.round(this.visibleEnd)
        }
      };
    }

    calculatePanelBounds(width) {
      const topPadding = 0;

      if (isDocumentScroller(this.scrollTarget)) {
        const growthBottom = this.calculateGrowthBottom(topPadding);
        const scrollbarGutter = this.getScrollbarGutter(this.scrollTarget);
        return {
          top: topPadding,
          bottom: growthBottom,
          left: null,
          right: scrollbarGutter,
          needsReservation: true
        };
      }

      const rect = this.scrollTarget.getBoundingClientRect();
      const top = clamp(Math.round(rect.top), 0, Math.max(0, window.innerHeight - 160));
      const bottom = clamp(Math.round(window.innerHeight - rect.bottom), 0, Math.max(0, window.innerHeight - top - 160));
      const growthBottom = this.calculateGrowthBottom(top);
      const effectiveBottom = Math.max(bottom, growthBottom);
      const hasReservation = this.layoutReservation && this.layoutReservation.target === this.scrollTarget;

      if (rect.right + width <= window.innerWidth) {
        return {
          top,
          bottom: effectiveBottom,
          left: Math.round(rect.right),
          right: null,
          needsReservation: Boolean(hasReservation)
        };
      }

      return {
        top,
        bottom: effectiveBottom,
        left: null,
        right: 0,
        needsReservation: true
      };
    }

    calculateGrowthBottom(topOffset = 0) {
      const vh = window.innerHeight;
      const targetHeight = this.calculateTargetPanelHeight(topOffset);
      return Math.max(0, Math.round(vh - topOffset - targetHeight));
    }

    calculateTargetPanelHeight(topOffset = 0) {
      const maxHeight = this.getMaxPanelHeight(topOffset);
      const visibleHeight = Math.max(getClientHeight(this.scrollTarget), 1);
      const scrollHeight = getScrollHeight(this.scrollTarget);
      const contentHeight = this.adapter.getConversationContentHeight
        ? this.adapter.getConversationContentHeight(this.scrollTarget)
        : scrollHeight;
      const scale = VIEWPORT_FIXED_HEIGHT / visibleHeight;
      const documentHeight = Math.max(1, Math.round(contentHeight * scale));
      return Math.max(1, Math.min(maxHeight, documentHeight));
    }

    getMaxPanelHeight(topOffset = 0) {
      const availableHeight = Math.max(1, window.innerHeight - topOffset);
      return Math.max(1, Math.min(getClientHeight(this.scrollTarget), availableHeight));
    }

    getScrollbarGutter(target) {
      if (isDocumentScroller(target)) {
        return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      }

      return Math.max(0, target.offsetWidth - target.clientWidth);
    }

    reserveLayoutSpace(width, bounds) {
      if (!bounds.needsReservation) {
        this.clearLayoutReservation();
        return;
      }

      const target = isDocumentScroller(this.scrollTarget)
        ? (document.body || document.documentElement)
        : this.scrollTarget;
      if (!target) {
        return;
      }

      if (!this.layoutReservation || this.layoutReservation.target !== target) {
        this.clearLayoutReservation();
        this.layoutReservation = {
          target,
          paddingInlineEnd: target.style.paddingInlineEnd,
          marginInlineEnd: target.style.marginInlineEnd,
          boxSizing: target.style.boxSizing
        };
      }

      target.style.boxSizing = "border-box";
      if (isDocumentScroller(this.scrollTarget)) {
        target.style.paddingInlineEnd = `${width}px`;
        target.style.marginInlineEnd = this.layoutReservation.marginInlineEnd;
      } else {
        target.style.marginInlineEnd = `${width}px`;
        target.style.paddingInlineEnd = this.layoutReservation.paddingInlineEnd;
      }
    }

    clearLayoutReservation() {
      if (!this.layoutReservation) {
        return;
      }

      const { target, paddingInlineEnd, marginInlineEnd, boxSizing } = this.layoutReservation;
      target.style.paddingInlineEnd = paddingInlineEnd;
      target.style.marginInlineEnd = marginInlineEnd;
      target.style.boxSizing = boxSizing;
      this.layoutReservation = null;
    }

    calculateWidth() {
      const base = DENSITY_WIDTH[this.settings.density] || DENSITY_WIDTH.comfortable;
      const boost = this.userBlocks.length >= 24 ? 18 : this.userBlocks.length >= 12 ? 10 : 0;
      if (window.innerWidth < 680) {
        return clamp(base - 22 + boost, 58, 96);
      }

      if (window.innerWidth < 980) {
        return clamp(base - 10 + boost, 66, 116);
      }

      return clamp(base + boost, 76, 150);
    }

    computeScrollState(panelWidth, panelHeight) {
      const scrollHeight = Math.max(getScrollHeight(this.scrollTarget), 1);
      const visibleHeight = Math.max(getClientHeight(this.scrollTarget), 1);
      const scrollTop = getScrollTop(this.scrollTarget);
      const maxScroll = Math.max(0, scrollHeight - visibleHeight);
      const contentHeight = this.adapter.getConversationContentHeight
        ? this.adapter.getConversationContentHeight(this.scrollTarget)
        : scrollHeight;

      this.scale = VIEWPORT_FIXED_HEIGHT / visibleHeight;
      this.documentHeight = Math.max(1, Math.round(contentHeight * this.scale));
      this.drawHeight = Math.min(panelHeight, this.documentHeight);
      this.viewportHeight = clamp(
        Math.round(visibleHeight * this.scale),
        0,
        Math.min(this.documentHeight, this.drawHeight)
      );

      this.viewportStart = clamp(
        Math.round(scrollTop * this.scale),
        0,
        Math.max(0, this.documentHeight - this.viewportHeight)
      );

      this.recomputeVisible();
      const scrollRatio = maxScroll > 0 ? clamp(scrollTop / maxScroll, 0, 1) : 0;

      return { scrollHeight, visibleHeight, scrollTop, panelWidth, panelHeight, maxScroll, scrollRatio, contentHeight };
    }

    recomputeVisible() {
      const maxViewportStart = Math.max(0, this.documentHeight - this.viewportHeight);
      if (this.drawHeight < this.documentHeight && this.viewportHeight > 0 && maxViewportStart > 0) {
        const maxVisibleStart = Math.max(0, this.documentHeight - this.drawHeight);
        const preferredVisibleStart = Math.round(this.viewportStart / maxViewportStart * maxVisibleStart);
        const minVisibleStart = Math.max(0, this.viewportStart + this.viewportHeight - this.drawHeight);
        const maxVisibleStartForViewport = Math.min(this.viewportStart, maxVisibleStart);
        this.visibleStart = clamp(
          preferredVisibleStart,
          Math.min(minVisibleStart, maxVisibleStartForViewport),
          maxVisibleStartForViewport
        );
        this.visibleEnd = Math.min(this.visibleStart + this.drawHeight, this.documentHeight);
        return;
      }

      this.visibleStart = 0;
      this.visibleEnd = this.drawHeight;
    }

    draw() {
      try {
        if (!this.settings.enabled || !this.canvas) {
          return;
        }

        const rect = this.panel.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const panelWidth = Math.max(1, Math.round(rect.width));
        const panelHeight = Math.max(1, Math.round(rect.height));
        this.computeScrollState(panelWidth, panelHeight);

        this.canvas.width = Math.round(panelWidth * dpr);
        this.canvas.height = Math.round(panelHeight * dpr);
        this.canvas.style.width = `${panelWidth}px`;
        this.canvas.style.height = `${panelHeight}px`;

        const ctx = this.canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, panelWidth, panelHeight);
        ctx.imageSmoothingEnabled = false;
        this.paintPanelBackground(ctx, panelWidth, this.drawHeight);
        this.paintUserBlocks(ctx, panelWidth);
        this.syncViewportElement();
        this.syncDebugAttributes();
        logger.debugEvent("draw_done", this.getStatusSnapshot());
      } catch (error) {
        this.modelStatus = "error";
        this.lastError = safeErrorMessage(error);
        this.syncDebugAttributes();
        logger.error("model_error", error, this.getStatusSnapshot());
      }
    }

    paintPanelBackground(ctx, width, height) {
      // Keep the minimap backing fully transparent so the page background shows through.
    }

    paintUserBlocks(ctx, width) {
      const inset = Math.max(7, Math.round(width * 0.09));
      const laneX = Math.round(width * 0.27);
      const laneWidth = Math.max(12, width - laneX - inset);

      for (const block of this.userBlocks) {
        const y = Math.round(block.top * this.scale - this.visibleStart);
        const h = Math.max(3, Math.round(block.height * this.scale));
        if (y + h < -4 || y > this.drawHeight + 4) {
          continue;
        }

        const blockY = clamp(y, -6, this.drawHeight + 6);
        const blockHeight = Math.min(Math.max(3, h), this.drawHeight - blockY + 8);

        ctx.globalAlpha = 0.84;
        ctx.fillStyle = this.contextTheme.user;
        this.roundedRect(ctx, laneX, blockY, laneWidth, blockHeight, Math.min(4, blockHeight / 2));
        ctx.fill();

        ctx.globalAlpha = 0.95;
        ctx.fillStyle = this.contextTheme.user;
        ctx.fillRect(width - 4, Math.max(0, blockY), 2, Math.max(2, Math.min(blockHeight, this.drawHeight - blockY)));
      }
      ctx.globalAlpha = 1;
    }

    getViewportPanelTop() {
      return clamp(
        this.viewportStart - this.visibleStart,
        0,
        Math.max(0, this.drawHeight - this.viewportHeight)
      );
    }

    syncViewportElement() {
      this.viewport.style.top = `${this.getViewportPanelTop()}px`;
      this.viewport.style.height = `${Math.max(2, this.viewportHeight)}px`;
    }

    roundedRect(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    handlePanelDown(event) {
      if (event.button !== 0) {
        return;
      }

      this.hideLens();

      if (event.target === this.resizeHandle) {
        this.resizing = true;
        this.resizeStartX = event.clientX;
        this.resizeStartWidth = this.panelWidth;
        this.resizeHandle.classList.add("active");
        event.preventDefault();
        return;
      }

      const y = event.clientY - this.panel.getBoundingClientRect().top;
      const viewportTop = this.getViewportPanelTop();
      const insideViewport = y >= viewportTop && y <= viewportTop + this.viewportHeight;
      this.draggingViewport = true;
      this.panel.classList.add("dragging");

      if (insideViewport) {
        this.dragStartY = y;
        this.dragStartDelta = viewportTop;
      } else {
        this.jumpToPanelY(y);
        this.dragStartY = y;
        this.dragStartDelta = this.getViewportPanelTop();
      }

      event.preventDefault();
    }

    handlePanelMove(event) {
      if (!this.settings.lensEnabled || this.draggingViewport || this.resizing || !this.messageBlocks.length) {
        this.hideLens();
        return;
      }

      const rect = this.panel.getBoundingClientRect();
      const y = event.clientY - rect.top;
      if (y < 0 || y > this.drawHeight) {
        this.hideLens();
        return;
      }

      const sourceY = (y + this.visibleStart) / Math.max(this.scale, 0.0001);
      const block = this.findLensBlock(sourceY);
      if (!block) {
        this.hideLens();
        return;
      }

      this.showLens(event.clientX, event.clientY, block);
    }

    findLensBlock(sourceY) {
      let best = null;
      let bestDistance = Infinity;

      for (const block of this.messageBlocks) {
        const top = block.top;
        const bottom = block.top + block.height;
        if (sourceY >= top && sourceY <= bottom) {
          return block;
        }

        const distance = Math.min(Math.abs(sourceY - top), Math.abs(sourceY - bottom));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = block;
        }
      }

      return bestDistance <= Math.max(80, getClientHeight(this.scrollTarget) * 0.12) ? best : null;
    }

    showLens(clientX, clientY, block) {
      if (!this.messageLens || !this.lensTitle || !this.lensText) {
        return;
      }

      const locale = this.resolveLocale();
      const roleLabel = this.getRoleLabel(block.role, locale);
      this.lensTitle.textContent = locale === "zh"
        ? `${roleLabel === "消息" ? "消息" : `${roleLabel}消息`} ${block.index}`
        : `${roleLabel === "Message" ? "Message" : `${roleLabel} message`} ${block.index}`;
      this.lensText.textContent = this.truncateText(block.text, 240);
      this.messageLens.classList.add("visible");
      this.messageLens.setAttribute("aria-hidden", "false");

      const lensRect = this.messageLens.getBoundingClientRect();
      const panelRect = this.panel.getBoundingClientRect();
      let left = panelRect.left - lensRect.width - 10;
      let top = clientY - 68;
      left = clamp(left, 16, window.innerWidth - lensRect.width - 16);
      top = clamp(top, 16, window.innerHeight - lensRect.height - 16);
      this.messageLens.style.left = `${left}px`;
      this.messageLens.style.top = `${top}px`;
      this.activeLensBlockId = block.id;
    }

    hideLens() {
      if (!this.messageLens) {
        return;
      }

      this.activeLensBlockId = "";
      this.messageLens.classList.remove("visible");
      this.messageLens.setAttribute("aria-hidden", "true");
    }

    resolveLocale() {
      if (this.settings.locale === "zh" || this.settings.locale === "en") {
        return this.settings.locale;
      }

      return /^zh\b/i.test(navigator.language || "") ? "zh" : "en";
    }

    getRoleLabel(role, locale) {
      if (locale === "zh") {
        if (role === "user") return "用户";
        if (role === "assistant") return "助手";
        return "消息";
      }

      if (role === "user") return "User";
      if (role === "assistant") return "Assistant";
      return "Message";
    }

    truncateText(text, maxLength) {
      const clean = `${text || ""}`.replace(/\s+/g, " ").trim();
      if (clean.length <= maxLength) {
        return clean;
      }

      return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
    }

    handleWindowMove(event) {
      if (this.resizing) {
        const nextWidth = clamp(this.resizeStartWidth - (event.clientX - this.resizeStartX), 58, 170);
        this.customWidth = Math.round(nextWidth);
        this.updateDimensions();
        this.draw();
        return;
      }

      if (!this.draggingViewport) {
        return;
      }

      const y = event.clientY - this.panel.getBoundingClientRect().top;
      const newViewportTop = this.dragStartDelta + (y - this.dragStartY);
      const movableHeight = Math.max(0, this.drawHeight - this.viewportHeight);
      const maxViewportStart = Math.max(0, this.documentHeight - this.viewportHeight);
      const targetViewportStart = clamp(this.visibleStart + clamp(newViewportTop, 0, movableHeight), 0, maxViewportStart);
      scrollToPosition(this.scrollTarget, targetViewportStart / Math.max(this.scale, 0.0001), false);
      this.draw();
    }

    handleWindowUp() {
      if (this.resizing) {
        this.resizing = false;
        this.resizeHandle.classList.remove("active");
      }

      if (this.draggingViewport) {
        this.draggingViewport = false;
        this.panel.classList.remove("dragging");
      }

      this.hideLens();
    }

    jumpToPanelY(y) {
      const panelHeight = this.drawHeight;
      const movableHeight = Math.max(0, panelHeight - this.viewportHeight);
      const maxViewportStart = Math.max(0, this.documentHeight - this.viewportHeight);
      const targetViewportTop = clamp(y - this.viewportHeight / 2, 0, movableHeight);
      const targetViewportStart = clamp(this.visibleStart + targetViewportTop, 0, maxViewportStart);
      scrollToPosition(this.scrollTarget, targetViewportStart / Math.max(this.scale, 0.0001), true);
    }

    handleWheel(event) {
      event.preventDefault();
      const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 28 : 1;
      scrollToPosition(this.scrollTarget, getScrollTop(this.scrollTarget) + event.deltaY * multiplier, false);
    }

    handleKeydown(event) {
      const current = getScrollTop(this.scrollTarget);
      const page = getClientHeight(this.scrollTarget) * 0.82;
      const maxTop = getScrollHeight(this.scrollTarget) - getClientHeight(this.scrollTarget);
      let next = null;

      if (event.key === "ArrowDown") next = current + 140;
      if (event.key === "ArrowUp") next = current - 140;
      if (event.key === "PageDown") next = current + page;
      if (event.key === "PageUp") next = current - page;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = maxTop;

      if (next !== null) {
        event.preventDefault();
        scrollToPosition(this.scrollTarget, next, false);
      }
    }
  }

  async function boot() {
    try {
      const adapter = new ChatGPTAdapter();
      if (!adapter.match()) {
        logger.log("adapter_unmatched", {
          reason: "unsupported_host",
          preview: document.documentElement.hasAttribute(PREVIEW_ATTR)
        }, "info", true);
        logger.endBootGroup();
        return;
      }

      logger.log("adapter_matched", {
        preview: document.documentElement.hasAttribute(PREVIEW_ATTR),
        roleStats: collectRoleStats()
      }, "info");
      const settings = await getFromStorage();
      logger.setSettings(settings);
      logger.log("settings_loaded", { settings }, "info");
      const app = new LLMGlancePanel(adapter, settings);
      app.mount();
      logger.endBootGroup();
    } catch (error) {
      logger.error("boot_error", error, { roleStats: collectRoleStats() });
      logger.endBootGroup();
    }
  }

  boot();
})();
