"use strict";

const VIEWPORT_FIXED_HEIGHT = 120;
const DENSITY_WIDTH = { compact: 76, comfortable: 96, roomy: 122 };

const SAMPLE_MESSAGES = [
	{ role: "user", text: "我想给 ChatGPT 加一个右侧 Glance 缩略图，类似 IDE 的 minimap，能看到整段对话长度和当前位置。" },
	{ role: "assistant", text: "可以做。把对话页面的滚动容器找出来，在它右侧锚一个 fixed 面板，根据滚动比例显示一个 viewport 指示当前可视区域。第一版只渲染用户消息位置就够了——助手回复不进缩略图。" },
	{ role: "user", text: "面板宽度多少合适？" },
	{ role: "assistant", text: "建议 96px 起步（comfortable 密度），用户可以拖左边沿 resize 到 58–170px 之间。窗口宽度小于 980px 时缩到 66–116px，更窄时缩到 58–96px。" },
	{ role: "user", text: "面板默认全屏高度看起来太重，能不能根据对话长短动态生长？" },
	{ role: "assistant", text: "好主意。面板先按 temp demo 的 minimap 坐标映射真实内容高度；短会话没有滚动条时，Glance 和 viewport 都可以小于 120px。" },
	{ role: "user", text: "viewport 滑块在长对话里被压成 2px 细条了，看不清。" },
	{ role: "assistant", text: "一旦缩放或对话变长导致滚动条出现，viewport 就扩展到固定 120px；之后只让外层 Glance 面板随内容长度变长。" },
	{ role: "user", text: "底部对齐能保证吗？" },
	{ role: "assistant", text: "数学验证：scale = 120 / visibleHeight，viewportStart = scrollTop × scale，拖动时再用 viewportStart / scale 回算 scrollTop。没有滚动条时 documentHeight 小于 120，viewport 会被 clamp 到内容高度。" },
	{ role: "user", text: "再补充些消息，看长对话效果。" },
	{ role: "assistant", text: "已补充。现在演示完整生长曲线：短会话轻巧，出现滚动后 viewport 固定为 120px，Glance 面板随着 documentHeight 逐步拉长。" }
];

const EXTRA_MESSAGES = [
	{ role: "user", text: "面板背景能不能透明一点？纯白色一条很丑。" },
	{ role: "assistant", text: "改成多层渐变 + backdrop-filter blur(20px) saturate(1.4)。半透明背景让页面底色透出来，加两个角光让面板有玻璃片质感。亮色暗色页面都自然融入。" },
	{ role: "user", text: "好像还是有点单调，加点呼吸感？" },
	{ role: "assistant", text: "加了角部 radial-gradient 光晕，hover 时 viewport 透明度从 0.16 升到 0.32，dragging 状态透明度再加深。viewport 自身也加 backdrop-filter blur，与面板形成层级感。" }
];

const state = {
	messages: [],
	dragging: false,
	dragStartY: 0,
	dragStartTop: 0,
	density: "comfortable",
	viewportStart: 0,
	viewportHeight: 0,
	visibleStart: 0,
	drawHeight: 0,
	documentHeight: 0,
	scale: 1,
	lensEnabled: true,
	viewportBorder: true,
	locale: "en",
	userBlocks: [],
	messageBlocks: [],
	activeUserElement: null,
	syncRaf: 0
};

const dom = {
	root: document.documentElement,
	chatScroll: document.getElementById("chatScroll"),
	track: document.getElementById("glanceTrack"),
	canvas: document.getElementById("glanceCanvas"),
	viewport: document.getElementById("glanceViewport"),
	pulse: document.getElementById("activePulse"),
	count: document.getElementById("messageCount"),
	themeSelect: document.getElementById("themeSelect"),
	densitySelect: document.getElementById("densitySelect"),
	lensToggle: document.getElementById("lensToggle"),
	marksToggle: document.getElementById("marksToggle"),
	languageToggle: document.getElementById("languageToggle"),
	addBtn: document.getElementById("addMessages"),
	resetBtn: document.getElementById("resetConvo"),
	messageLens: document.getElementById("messageLens"),
	lensTitle: document.getElementById("lensTitle"),
	lensText: document.getElementById("lensText")
};

init();

function init() {
	state.messages = SAMPLE_MESSAGES.slice();
	renderMessages();
	applyDensity("comfortable");
	bindEvents();
	applyLocale();
	scheduleSyncGlance();
}

function bindEvents() {
	dom.chatScroll.addEventListener("scroll", scheduleSyncGlance, { passive: true });
	window.addEventListener("resize", () => {
		cacheMessageBlocks();
		scheduleSyncGlance();
	});

	dom.themeSelect.addEventListener("change", e => {
		if (e.target.value === "dark") dom.root.removeAttribute("data-theme");
		else dom.root.setAttribute("data-theme", e.target.value);
		scheduleSyncGlance();
	});

	dom.densitySelect.addEventListener("change", e => {
		applyDensity(e.target.value);
		scheduleSyncGlance();
	});

	dom.lensToggle.addEventListener("click", () => {
		state.lensEnabled = !state.lensEnabled;
		dom.lensToggle.setAttribute("aria-pressed", String(state.lensEnabled));
		if (!state.lensEnabled) hideLens();
	});

	dom.marksToggle.addEventListener("click", () => {
		state.viewportBorder = !state.viewportBorder;
		dom.marksToggle.setAttribute("aria-pressed", String(state.viewportBorder));
		scheduleSyncGlance();
	});

	dom.languageToggle.addEventListener("click", () => {
		state.locale = state.locale === "zh" ? "en" : "zh";
		applyLocale();
	});

	dom.addBtn.addEventListener("click", () => {
		const next = EXTRA_MESSAGES[state.messages.length % EXTRA_MESSAGES.length];
		state.messages.push({ ...next });
		renderMessages();
		scheduleSyncGlance();
		dom.chatScroll.scrollTo({ top: dom.chatScroll.scrollHeight, behavior: smoothScrollBehavior() });
	});

	dom.resetBtn.addEventListener("click", () => {
		state.messages = SAMPLE_MESSAGES.slice();
		renderMessages();
		dom.chatScroll.scrollTop = 0;
		scheduleSyncGlance();
	});

	dom.track.addEventListener("pointerdown", handleTrackDown);
	dom.track.addEventListener("pointermove", handleTrackMoveForLens);
	dom.track.addEventListener("pointerleave", hideLens);
	dom.track.addEventListener("wheel", handleWheel, { passive: false });
	dom.track.addEventListener("keydown", handleTrackKey);
	window.addEventListener("pointermove", handleTrackMove);
	window.addEventListener("pointerup", handleTrackUp);
}

function applyDensity(density) {
	state.density = density;
	const width = DENSITY_WIDTH[density] || DENSITY_WIDTH.comfortable;
	dom.track.style.width = `${width}px`;
}

function renderMessages() {
	state.activeUserElement = null;
	const html = state.messages.map(msg => `
		<article class="message ${msg.role}" data-role="${msg.role}">
			<span class="role">${msg.role === "user" ? "You" : "Assistant"}</span>
			${escapeHtml(msg.text)}
		</article>
	`).join("");
	dom.chatScroll.innerHTML = html;
	cacheMessageBlocks();

	const userCount = state.messages.filter(m => m.role === "user").length;
	dom.count.textContent = `${state.messages.length} messages · ${userCount} from you`;
}

function cacheMessageBlocks() {
	const messageBlocks = [];
	const userBlocks = [];
	dom.chatScroll.querySelectorAll(".message").forEach((node, index) => {
		const block = {
			index: index + 1,
			role: node.dataset.role || "message",
			text: (node.textContent || "").replace(/\s+/g, " ").trim(),
			top: node.offsetTop,
			height: node.offsetHeight,
			element: node
		};
		messageBlocks.push(block);
		if (block.role === "user") {
			userBlocks.push(block);
		}
	});
	state.messageBlocks = messageBlocks;
	state.userBlocks = userBlocks;
}

function applyLocale() {
	const zh = state.locale === "zh";
	dom.languageToggle.textContent = zh ? "English" : "中文";
	dom.lensToggle.textContent = "Lens";
	dom.marksToggle.textContent = zh ? "边框" : "Marks";
	dom.addBtn.textContent = zh ? "+ 添加消息" : "+ Add Messages";
	dom.resetBtn.textContent = zh ? "重置" : "Reset";
}

function getUserBlocks() {
	return { blocks: state.userBlocks, scrollTop: dom.chatScroll.scrollTop };
}

function getMessageBlocks() {
	return state.messageBlocks;
}

function calculateGrowthHeight() {
	const trackParent = dom.track.parentElement.getBoundingClientRect();
	const maxHeight = Math.max(1, trackParent.height);
	const visibleHeight = Math.max(dom.chatScroll.clientHeight, 1);
	const contentHeight = resolveConversationContentHeight(visibleHeight);
	const scale = VIEWPORT_FIXED_HEIGHT / visibleHeight;
	const documentHeight = Math.max(1, Math.round(contentHeight * scale));
	return Math.min(maxHeight, documentHeight);
}

function resolveConversationContentHeight(visibleHeight) {
	const scrollHeight = Math.max(dom.chatScroll.scrollHeight, 1);
	if (scrollHeight > visibleHeight + 1) {
		return scrollHeight;
	}

	let contentBottom = 0;
	for (const block of state.messageBlocks) {
		contentBottom = Math.max(contentBottom, block.top + block.height);
	}
	return Math.max(1, contentBottom || scrollHeight);
}

function scheduleSyncGlance() {
	if (state.syncRaf) {
		return;
	}

	state.syncRaf = requestAnimationFrame(() => {
		state.syncRaf = 0;
		syncGlance();
	});
}

function syncGlance() {
	const targetHeight = calculateGrowthHeight();
	dom.track.style.height = `${targetHeight}px`;

	const rect = dom.track.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const panelWidth = Math.max(1, Math.round(rect.width));
	const panelHeight = Math.max(1, Math.round(rect.height));

	const scrollHeight = Math.max(dom.chatScroll.scrollHeight, 1);
	const clientHeight = Math.max(dom.chatScroll.clientHeight, 1);
	const scrollTop = dom.chatScroll.scrollTop;
	const maxScroll = Math.max(0, scrollHeight - clientHeight);
	const contentHeight = resolveConversationContentHeight(clientHeight);

	state.scale = VIEWPORT_FIXED_HEIGHT / clientHeight;
	state.documentHeight = Math.max(1, Math.round(contentHeight * state.scale));
	state.drawHeight = Math.min(panelHeight, state.documentHeight);
	state.viewportHeight = clamp(
		Math.round(clientHeight * state.scale),
		0,
		Math.min(state.documentHeight, state.drawHeight)
	);
	state.viewportStart = clamp(
		Math.round(scrollTop * state.scale),
		0,
		Math.max(0, state.documentHeight - state.viewportHeight)
	);
	recomputeVisible();
	dom.viewport.classList.toggle("with-border", state.viewportBorder);

	const viewportTop = getViewportPanelTop();
	const ratio = maxScroll > 0 ? clamp(scrollTop / maxScroll, 0, 1) : 0;

	dom.viewport.style.height = `${state.viewportHeight}px`;
	dom.viewport.style.top = `${viewportTop}px`;
	dom.track.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
	dom.track.setAttribute("aria-valuemin", "0");
	dom.track.setAttribute("aria-valuemax", "100");

	dom.canvas.width = Math.round(panelWidth * dpr);
	dom.canvas.height = Math.round(panelHeight * dpr);
	dom.canvas.style.width = `${panelWidth}px`;
	dom.canvas.style.height = `${panelHeight}px`;

	const ctx = dom.canvas.getContext("2d");
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, panelWidth, panelHeight);

	paintBackground(ctx, panelWidth, state.drawHeight);
	paintUserBlocks(ctx, panelWidth);
	syncActivePulse();
}

function recomputeVisible() {
	const maxViewportStart = Math.max(0, state.documentHeight - state.viewportHeight);
	if (state.drawHeight < state.documentHeight && state.viewportHeight > 0 && maxViewportStart > 0) {
		const maxVisibleStart = Math.max(0, state.documentHeight - state.drawHeight);
		const preferredVisibleStart = Math.round(state.viewportStart / maxViewportStart * maxVisibleStart);
		const minVisibleStart = Math.max(0, state.viewportStart + state.viewportHeight - state.drawHeight);
		const maxVisibleStartForViewport = Math.min(state.viewportStart, maxVisibleStart);
		state.visibleStart = clamp(
			preferredVisibleStart,
			Math.min(minVisibleStart, maxVisibleStartForViewport),
			maxVisibleStartForViewport
		);
		return;
	}

	state.visibleStart = 0;
}

function getViewportPanelTop() {
	return clamp(
		state.viewportStart - state.visibleStart,
		0,
		Math.max(0, state.drawHeight - state.viewportHeight)
	);
}

function paintBackground(ctx, width, height) {
	// Keep the minimap backing fully transparent so the page background shows through.
}

function paintUserBlocks(ctx, width) {
	const styles = getComputedStyle(dom.root);
	const userColor = styles.getPropertyValue("--accent").trim() || "#60a5fa";

	const inset = Math.max(7, Math.round(width * 0.09));
	const laneX = Math.round(width * 0.27);
	const laneWidth = Math.max(12, width - laneX - inset);

	const { blocks } = getUserBlocks();
	for (const block of blocks) {
		const y = Math.round(block.top * state.scale - state.visibleStart);
		const h = Math.max(3, Math.round(block.height * state.scale));

		if (y + h < -4 || y > state.drawHeight + 4) {
			continue;
		}

		ctx.globalAlpha = 0.84;
		ctx.fillStyle = userColor;
		roundedRect(ctx, laneX, y, laneWidth, h, Math.min(4, h / 2));
		ctx.fill();

		ctx.globalAlpha = 0.95;
		ctx.fillStyle = userColor;
		ctx.fillRect(width - 4, Math.max(0, y), 2, Math.max(2, h));
	}
	ctx.globalAlpha = 1;
}

function syncActivePulse() {
	const activeBlock = findActiveUserBlock();
	if (state.activeUserElement && (!activeBlock || state.activeUserElement !== activeBlock.element)) {
		state.activeUserElement.classList.remove("is-active");
		state.activeUserElement = null;
	}

	if (!activeBlock) {
		dom.pulse.classList.remove("visible");
		return;
	}

	activeBlock.element.classList.add("is-active");
	state.activeUserElement = activeBlock.element;

	const blockY = Math.round(activeBlock.top * state.scale - state.visibleStart);
	const blockH = Math.max(3, Math.round(activeBlock.height * state.scale));
	const pulseY = blockY + Math.round(blockH / 2) - 7;

	dom.pulse.style.top = `${clamp(pulseY, 0, Math.max(0, state.drawHeight - 14))}px`;
	dom.pulse.classList.add("visible");
}

function findActiveUserBlock() {
	const scrollTop = dom.chatScroll.scrollTop;
	const clientHeight = dom.chatScroll.clientHeight;
	const viewTop = scrollTop;
	const viewBottom = scrollTop + clientHeight;
	let best = null;
	let bestVisible = 0;

	for (const block of state.userBlocks) {
		const top = block.top;
		const bottom = top + block.height;
		const visibleTop = Math.max(top, viewTop);
		const visibleBottom = Math.min(bottom, viewBottom);
		const visibleArea = Math.max(0, visibleBottom - visibleTop);
		if (visibleArea > bestVisible) {
			bestVisible = visibleArea;
			best = block;
		}
	}

	return best;
}

function roundedRect(ctx, x, y, width, height, radius) {
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

function handleTrackDown(event) {
	if (event.button !== 0) return;
	hideLens();
	const rect = dom.track.getBoundingClientRect();
	const y = event.clientY - rect.top;
	const viewportTop = getViewportPanelTop();
	const insideViewport = y >= viewportTop && y <= viewportTop + state.viewportHeight;

	state.dragging = true;
	dom.track.classList.add("dragging");
	if (insideViewport) {
		state.dragStartY = y;
		state.dragStartTop = viewportTop;
	} else {
		jumpToY(y);
		state.dragStartY = y;
		state.dragStartTop = getViewportPanelTop();
	}
	event.preventDefault();
}

function handleTrackMoveForLens(event) {
	if (!state.lensEnabled || state.dragging) {
		hideLens();
		return;
	}

	const rect = dom.track.getBoundingClientRect();
	const y = event.clientY - rect.top;
	if (y < 0 || y > state.drawHeight) {
		hideLens();
		return;
	}

	const sourceY = (y + state.visibleStart) / Math.max(state.scale, 0.0001);
	const block = findLensBlock(sourceY);
	if (!block) {
		hideLens();
		return;
	}

	showLens(event.clientX, event.clientY, block);
}

function findLensBlock(sourceY) {
	let best = null;
	let bestDistance = Infinity;
	for (const block of getMessageBlocks()) {
		const bottom = block.top + block.height;
		if (sourceY >= block.top && sourceY <= bottom) return block;
		const distance = Math.min(Math.abs(sourceY - block.top), Math.abs(sourceY - bottom));
		if (distance < bestDistance) {
			bestDistance = distance;
			best = block;
		}
	}
	return bestDistance <= Math.max(80, dom.chatScroll.clientHeight * 0.12) ? best : null;
}

function showLens(clientX, clientY, block) {
	const role = state.locale === "zh"
		? (block.role === "user" ? "用户" : "助手")
		: (block.role === "user" ? "User" : "Assistant");
	dom.lensTitle.textContent = state.locale === "zh"
		? `${role}消息 ${block.index}`
		: `${role} message ${block.index}`;
	dom.lensText.textContent = truncateText(block.text, 240);
	dom.messageLens.classList.add("visible");
	dom.messageLens.setAttribute("aria-hidden", "false");

	const lensRect = dom.messageLens.getBoundingClientRect();
	const panelRect = dom.track.getBoundingClientRect();
	let left = panelRect.left - lensRect.width - 10;
	let top = clientY - 68;
	left = clamp(left, 16, window.innerWidth - lensRect.width - 16);
	top = clamp(top, 16, window.innerHeight - lensRect.height - 16);
	dom.messageLens.style.left = `${left}px`;
	dom.messageLens.style.top = `${top}px`;
}

function hideLens() {
	dom.messageLens.classList.remove("visible");
	dom.messageLens.setAttribute("aria-hidden", "true");
}

function handleTrackMove(event) {
	if (!state.dragging) return;
	const rect = dom.track.getBoundingClientRect();
	const y = event.clientY - rect.top;
	const newViewportTop = state.dragStartTop + (y - state.dragStartY);
	const movableHeight = Math.max(0, state.drawHeight - state.viewportHeight);
	const maxViewportStart = Math.max(0, state.documentHeight - state.viewportHeight);
	const targetViewportStart = clamp(state.visibleStart + clamp(newViewportTop, 0, movableHeight), 0, maxViewportStart);
	dom.chatScroll.scrollTop = targetViewportStart / Math.max(state.scale, 0.0001);
}

function handleTrackUp() {
	if (state.dragging) {
		state.dragging = false;
		dom.track.classList.remove("dragging");
	}
	hideLens();
}

function handleWheel(event) {
	event.preventDefault();
	dom.chatScroll.scrollTop += event.deltaY;
}

function handleTrackKey(event) {
	const maxScroll = Math.max(0, dom.chatScroll.scrollHeight - dom.chatScroll.clientHeight);
	const page = dom.chatScroll.clientHeight * 0.8;
	let next = null;

	if (event.key === "ArrowDown") next = dom.chatScroll.scrollTop + 80;
	else if (event.key === "ArrowUp") next = dom.chatScroll.scrollTop - 80;
	else if (event.key === "PageDown") next = dom.chatScroll.scrollTop + page;
	else if (event.key === "PageUp") next = dom.chatScroll.scrollTop - page;
	else if (event.key === "Home") next = 0;
	else if (event.key === "End") next = maxScroll;
	else return;

	event.preventDefault();
	dom.chatScroll.scrollTop = clamp(next, 0, maxScroll);
}

function smoothScrollBehavior() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function jumpToY(y) {
	const movableHeight = Math.max(0, state.drawHeight - state.viewportHeight);
	const maxViewportStart = Math.max(0, state.documentHeight - state.viewportHeight);
	const targetTop = clamp(y - state.viewportHeight / 2, 0, movableHeight);
	const targetViewportStart = clamp(state.visibleStart + targetTop, 0, maxViewportStart);
	dom.chatScroll.scrollTo({
		top: targetViewportStart / Math.max(state.scale, 0.0001),
		behavior: smoothScrollBehavior()
	});
}

function clamp(v, min, max) {
	return Math.min(Math.max(v, min), max);
}

function truncateText(text, maxLength) {
	const clean = `${text || ""}`.replace(/\s+/g, " ").trim();
	if (clean.length <= maxLength) return clean;
	return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
}

function escapeHtml(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
