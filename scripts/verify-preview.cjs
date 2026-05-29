"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const Module = require("module");

const root = path.resolve(__dirname, "..");
const shotPath = path.join(root, "demo", "preview-shot.png");
const previewUrlPath = "/demo/preview.html";
const systemEdgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function enableCodexRuntimeModules() {
  const userHome = process.env.USERPROFILE || process.env.HOME;
  if (!userHome) {
    return;
  }

  const runtimeRoot = path.join(
    userHome,
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "node"
  );
  const runtimeNodeModules = path.join(runtimeRoot, "node_modules");
  const pnpmDir = path.join(runtimeNodeModules, ".pnpm");
  const extraModuleDirs = [runtimeNodeModules];

  if (!fs.existsSync(runtimeNodeModules)) {
    return;
  }

  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir)) {
      if (entry.startsWith("playwright-core@") || entry.startsWith("playwright@")) {
        const nestedModules = path.join(pnpmDir, entry, "node_modules");
        if (fs.existsSync(nestedModules)) {
          extraModuleDirs.push(nestedModules);
        }
      }
    }
  }

  process.env.NODE_PATH = process.env.NODE_PATH
    ? `${extraModuleDirs.join(path.delimiter)}${path.delimiter}${process.env.NODE_PATH}`
    : extraModuleDirs.join(path.delimiter);
  Module._initPaths();
}

function requirePlaywright() {
  try {
    return require("playwright");
  } catch {
    enableCodexRuntimeModules();
    return require("playwright");
  }
}

function createStaticServer(port) {
  const server = http.createServer((request, response) => {
    let requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
    if (requestPath === "/") {
      requestPath = previewUrlPath;
    }

    const filePath = path.normalize(path.join(root, requestPath));
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("missing");
        return;
      }

      const ext = path.extname(filePath);
      const contentType = ext === ".html"
        ? "text/html"
        : ext === ".js"
          ? "text/javascript"
          : ext === ".css"
            ? "text/css"
            : "application/octet-stream";
      response.writeHead(200, { "content-type": contentType });
      response.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const { chromium } = requirePlaywright();
  const port = 8877;
  const server = await createStaticServer(port);
  fs.rmSync(shotPath, { force: true });

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(systemEdgePath) ? systemEdgePath : undefined
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}${previewUrlPath}`, { waitUntil: "networkidle" });
    await page.waitForSelector("llm-glance-panel", { timeout: 5000 });
    await page.waitForTimeout(300);

    const collectEvidence = () => page.evaluate(() => {
      const root = document.querySelector("llm-glance-panel");
      const shadow = root && root.shadowRoot;
      const panel = shadow && shadow.querySelector(".glance-panel");
      const viewport = shadow && shadow.querySelector(".viewport");
      const canvas = shadow && shadow.querySelector("canvas");
      const scroller = document.querySelector("[data-llm-glance-scroll]");
      const rootRect = root && root.getBoundingClientRect();
      const panelRect = panel && panel.getBoundingClientRect();
      const viewportRect = viewport && viewport.getBoundingClientRect();
      const scrollerRect = scroller && scroller.getBoundingClientRect();
      const viewportStyle = viewport && getComputedStyle(viewport);
      const canvasPixels = canvas && canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let paintedPixels = 0;
      if (canvasPixels) {
        for (let index = 3; index < canvasPixels.length; index += 4) {
          if (canvasPixels[index] > 0) {
            paintedPixels += 1;
          }
        }
      }

      return {
        hasRoot: Boolean(root),
        hasPanel: Boolean(panel),
        hasViewport: Boolean(viewport),
        hasCanvas: Boolean(canvas),
        rootLeft: rootRect && Math.round(rootRect.left),
        rootRight: rootRect && Math.round(rootRect.right),
        panelWidth: panelRect && Math.round(panelRect.width),
        panelHeight: panelRect && Math.round(panelRect.height),
        viewportHeight: viewportRect && Math.round(viewportRect.height),
        viewportBackdropFilter: viewportStyle && viewportStyle.backdropFilter,
        scrollerRight: scrollerRect && Math.round(scrollerRect.right),
        modelStatus: root && root.dataset.llmgStatus,
        lastError: root && root.dataset.llmgLastError,
        renderMode: root && root.dataset.llmgRenderMode,
        userBlockCount: root ? Number(root.dataset.llmgUserBlockCount || 0) : 0,
        roleCount: root ? Number(root.dataset.llmgRoleCount || 0) : 0,
        assistantRoleCount: root ? Number(root.dataset.llmgAssistantRoleCount || 0) : 0,
        scrollTarget: root && root.dataset.llmgScrollTarget,
        debugPanelWidth: root ? Number(root.dataset.llmgPanelWidth || 0) : 0,
        debugScrollHeight: root ? Number(root.dataset.llmgScrollHeight || 0) : 0,
        debugViewportHeight: root ? Number(root.dataset.llmgViewportHeight || 0) : 0,
        userTurnCount: document.querySelectorAll('[data-message-author-role="user"]').length,
        assistantTurnCount: document.querySelectorAll('[data-message-author-role="assistant"]').length,
        paintedPixels
      };
    });

    const initialEvidence = await collectEvidence();

    await page.evaluate(() => {
      document.querySelectorAll('[data-message-author-role="user"]').forEach((node) => {
        node.remove();
      });
    });

    await page.waitForFunction(() => {
      const root = document.querySelector("llm-glance-panel");
      return root
        && root.dataset.llmgStatus === "empty"
        && Number(root.dataset.llmgUserBlockCount || 0) === 0
        && Number(root.dataset.llmgAssistantRoleCount || 0) > 0;
    }, { timeout: 5000 });
    const emptyEvidence = await collectEvidence();

    await page.evaluate(() => {
      const main = document.querySelector("main");
      for (let index = 0; index < 20; index += 1) {
        const article = document.createElement("article");
        article.dataset.testid = `conversation-turn-extra-user-${index + 1}`;
        article.setAttribute("data-message-author-role", "user");

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = `追加用户消息 ${index + 1}：用于验证 Glance 只把用户 chat 模块映射到右侧面板，并在长会话下自动调整宽度。`;

        article.appendChild(bubble);
        main.appendChild(article);
      }
    });

    await page.waitForFunction((beforeWidth) => {
      const root = document.querySelector("llm-glance-panel");
      const userCount = document.querySelectorAll('[data-message-author-role="user"]').length;
      return root
        && Number(root.dataset.llmgUserBlockCount || 0) === userCount
        && Number(root.dataset.llmgPanelWidth || 0) > beforeWidth;
    }, initialEvidence.debugPanelWidth || initialEvidence.panelWidth, { timeout: 5000 });
    await page.waitForTimeout(150);

    const evidence = await collectEvidence();
    evidence.initialPanelWidth = initialEvidence.panelWidth;
    evidence.initialDebugPanelWidth = initialEvidence.debugPanelWidth;
    evidence.initialUserTurnCount = initialEvidence.userTurnCount;
    evidence.emptyModelStatus = emptyEvidence.modelStatus;
    evidence.emptyUserBlockCount = emptyEvidence.userBlockCount;
    evidence.emptyAssistantRoleCount = emptyEvidence.assistantRoleCount;

    const failures = [];
    if (!evidence.hasRoot || !evidence.hasPanel || !evidence.hasViewport || !evidence.hasCanvas) {
      failures.push("Glance panel DOM is incomplete.");
    }
    if (evidence.scrollerRight !== evidence.rootLeft) {
      failures.push(`Panel is not anchored to the scroll container edge: scrollerRight=${evidence.scrollerRight}, rootLeft=${evidence.rootLeft}.`);
    }
    if (evidence.renderMode !== "user-only") {
      failures.push(`Unexpected render mode: ${evidence.renderMode}.`);
    }
    if (evidence.modelStatus !== "ready") {
      failures.push(`Expected ready model status after delayed user messages, got ${evidence.modelStatus}.`);
    }
    if (evidence.emptyModelStatus !== "empty" || evidence.emptyUserBlockCount !== 0 || evidence.emptyAssistantRoleCount <= 0) {
      failures.push(`Assistant-only empty state failed: status=${evidence.emptyModelStatus}, userBlocks=${evidence.emptyUserBlockCount}, assistants=${evidence.emptyAssistantRoleCount}.`);
    }
    if (evidence.userTurnCount <= 0 || evidence.assistantTurnCount <= 0) {
      failures.push("Preview conversation did not render both user and assistant turns.");
    }
    if (evidence.userBlockCount !== evidence.userTurnCount) {
      failures.push(`User-only model mismatch: userBlockCount=${evidence.userBlockCount}, userTurnCount=${evidence.userTurnCount}.`);
    }
    if (evidence.userTurnCount <= evidence.initialUserTurnCount) {
      failures.push("Dynamic user-message append did not increase the model size.");
    }
    if (evidence.debugPanelWidth <= evidence.initialDebugPanelWidth) {
      failures.push(`Auto width did not grow after adding user modules: before=${evidence.initialDebugPanelWidth}, after=${evidence.debugPanelWidth}.`);
    }
    if (evidence.paintedPixels <= 0) {
      failures.push("Canvas did not paint visible content.");
    }
    if (evidence.viewportHeight <= 1) {
      failures.push("Viewport overlay height is too small.");
    }

    await page.evaluate(() => {
      const workspace = document.querySelector(".workspace");
      if (workspace) {
        workspace.style.gridTemplateColumns = "minmax(0, 1fr)";
      }
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(150);
    const reservedEvidence = await collectEvidence();
    resultReservedEvidence(evidence, reservedEvidence);

    if (reservedEvidence.scrollerRight !== reservedEvidence.rootLeft) {
      failures.push(`Reserved layout did not place Glance after the scroll container: scrollerRight=${reservedEvidence.scrollerRight}, rootLeft=${reservedEvidence.rootLeft}.`);
    }

    await page.screenshot({ path: shotPath, fullPage: false });
    const result = {
      screenshot: shotPath,
      screenshotBytes: fs.statSync(shotPath).size,
      evidence,
      failures
    };
    console.log(JSON.stringify(result, null, 2));

    if (failures.length) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    server.close();
  }
}

function resultReservedEvidence(evidence, reservedEvidence) {
  evidence.reservedRootLeft = reservedEvidence.rootLeft;
  evidence.reservedScrollerRight = reservedEvidence.scrollerRight;
  evidence.reservedPanelWidth = reservedEvidence.panelWidth;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
