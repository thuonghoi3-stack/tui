import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as changePct, c as focusOfMarker, d as normalizeSymbol, f as papersFrom, i as analyze, l as hourOf, n as INTERVAL_LABEL, o as clampParams, p as pnlPct, r as SESSIONS, s as defaultParams, t as INTERVALS, u as mergeJournal } from "./engine-DxmBSIx4.mjs";
import { n as RefreshCw } from "../_libs/lucide-react.mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DTRjX1dX.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function formatPx(n) {
	if (!Number.isFinite(n)) return "—";
	const abs = Math.abs(n);
	const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
	return n.toLocaleString("en-US", {
		minimumFractionDigits: Math.min(2, digits),
		maximumFractionDigits: digits
	});
}
function formatPct(n, digits = 2) {
	if (!Number.isFinite(n)) return "—";
	return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}
function formatVol(n) {
	if (!Number.isFinite(n)) return "—";
	const abs = Math.abs(n);
	if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
	if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
	if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
	return n.toFixed(0);
}
var vnTime = new Intl.DateTimeFormat("vi-VN", {
	timeZone: "Asia/Ho_Chi_Minh",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23"
});
var vnDateTime = new Intl.DateTimeFormat("vi-VN", {
	timeZone: "Asia/Ho_Chi_Minh",
	day: "2-digit",
	month: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23"
});
var vnClock = new Intl.DateTimeFormat("vi-VN", {
	timeZone: "Asia/Ho_Chi_Minh",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23"
});
var utcClock = new Intl.DateTimeFormat("en-GB", {
	timeZone: "UTC",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23"
});
function formatVn(ms, withDate = false) {
	if (!Number.isFinite(ms)) return "—";
	return (withDate ? vnDateTime : vnTime).format(ms);
}
function formatClock(ms) {
	return {
		vn: vnClock.format(ms),
		utc: utcClock.format(ms)
	};
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function parseBoard(input) {
	if (!input || typeof input !== "object") throw new Error("Thiếu dữ liệu");
	const raw = input;
	if (!Array.isArray(raw.symbols) || raw.symbols.length < 1 || raw.symbols.length > 8) throw new Error("Danh sách cặp không hợp lệ");
	const symbols = raw.symbols.map((symbol) => {
		if (typeof symbol !== "string" || !/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error("Mã cặp không hợp lệ");
		return symbol;
	});
	if (typeof raw.interval !== "string" || !INTERVALS.includes(raw.interval)) throw new Error("Khung thời gian không hợp lệ");
	const limit = typeof raw.limit === "number" && Number.isFinite(raw.limit) ? Math.min(500, Math.max(120, Math.floor(raw.limit))) : 500;
	return {
		symbols,
		interval: raw.interval,
		limit
	};
}
var fetchBoard = createServerFn({ method: "POST" }).validator((input) => parseBoard(input)).handler(createSsrRpc("75d2a007761a0e4420b8f8f57d0d3973db207906086d2400df577767f21dbfca"));
var memory = /* @__PURE__ */ new Map();
var memoryStorage = {
	getItem: (key) => memory.get(key) ?? null,
	setItem: (key, value) => {
		memory.set(key, value);
	},
	removeItem: (key) => {
		memory.delete(key);
	}
};
function deskStorage() {
	const base = typeof window === "undefined" ? memoryStorage : localStorage;
	return {
		getItem: (key) => {
			const raw = base.getItem(key);
			if (!raw) return null;
			try {
				const parsed = JSON.parse(raw);
				if (parsed && typeof parsed === "object" && parsed.state && typeof parsed.version !== "number") return JSON.stringify({
					...parsed,
					version: 0
				});
			} catch {
				return raw;
			}
			return raw;
		},
		setItem: (key, value) => base.setItem(key, value),
		removeItem: (key) => base.removeItem(key)
	};
}
var useDesk = create()(persist((set, get) => ({
	symbols: [
		"BTCUSDT",
		"ETHUSDT",
		"SOLUSDT",
		"BNBUSDT",
		"XRPUSDT"
	],
	active: "BTCUSDT",
	interval: "5m",
	params: defaultParams,
	journal: [],
	hydrated: false,
	setActive: (active) => set({ active }),
	setInterval: (interval) => set({ interval }),
	addSymbol: (raw) => {
		const symbol = normalizeSymbol(raw);
		if (symbol.length < 5 || symbol.length > 20) return "Nhập mã, ví dụ SOL hoặc ETHUSDT.";
		const symbols = get().symbols;
		if (symbols.includes(symbol)) {
			set({ active: symbol });
			return null;
		}
		if (symbols.length >= 8) return "Tối đa 8 cặp trên bàn.";
		set({
			symbols: [...symbols, symbol],
			active: symbol
		});
		return null;
	},
	removeSymbol: (symbol) => {
		const symbols = get().symbols.filter((item) => item !== symbol);
		if (symbols.length === 0) return;
		set({
			symbols,
			active: get().active === symbol ? symbols[0] : get().active
		});
	},
	setParams: (patch) => set({ params: clampParams({
		...get().params,
		...patch
	}) }),
	resetParams: () => set({ params: defaultParams }),
	setJournal: (journal) => set({ journal }),
	clearJournal: () => set({ journal: [] })
}), {
	name: "orca-desk",
	version: 2,
	migrate: (persisted, version) => {
		if (!persisted || typeof persisted !== "object") return persisted;
		const state = persisted;
		if (version < 1 && state.params?.smaDist === 2) state.params = {
			...state.params,
			smaDist: .3
		};
		if (version < 2) {
			state.interval = "5m";
			state.params = {
				...state.params ?? defaultParams,
				atrPeriod: 14,
				smaDist: .1,
				smaLook: 2,
				slPct: 6,
				tpPct: 3.2,
				requireSma: false
			};
		}
		return state;
	},
	storage: createJSONStorage(deskStorage),
	skipHydration: true,
	partialize: (state) => ({
		symbols: state.symbols,
		active: state.active,
		interval: state.interval,
		params: state.params,
		journal: state.journal
	})
}));
function PriceChart({ resetKey, candles, analysis, trade, pinned, onPin }) {
	const boxRef = (0, import_react.useRef)(null);
	const dragRef = (0, import_react.useRef)(null);
	const [size, setSize] = (0, import_react.useState)({
		w: 0,
		h: 0
	});
	const [count, setCount] = (0, import_react.useState)(130);
	const [end, setEnd] = (0, import_react.useState)(-1);
	const [hover, setHover] = (0, import_react.useState)(null);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setCount(130);
		setEnd(-1);
		setHover(null);
	}, [resetKey]);
	(0, import_react.useEffect)(() => {
		const el = boxRef.current;
		if (!el) return;
		const apply = () => {
			const rect = el.getBoundingClientRect();
			setSize({
				w: Math.max(0, Math.floor(rect.width)),
				h: Math.max(0, Math.floor(rect.height))
			});
		};
		apply();
		const observer = new ResizeObserver(apply);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	(0, import_react.useEffect)(() => {
		const el = boxRef.current;
		if (!el) return;
		const onWheel = (event) => {
			event.preventDefault();
			setCount((value) => {
				const next = Math.round(value * (event.deltaY > 0 ? 1.14 : .88));
				return Math.min(Math.max(candles.length, 40), Math.max(40, next));
			});
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [candles.length]);
	const last = Math.max(0, candles.length - 1);
	const viewCount = Math.min(candles.length, Math.max(40, count));
	const endIndex = end < 0 ? last : Math.min(last, Math.max(viewCount - 1, end));
	const startIndex = Math.max(0, endIndex - viewCount + 1);
	let minP = Infinity;
	let maxP = -Infinity;
	for (let i = startIndex; i <= endIndex && i < candles.length; i += 1) {
		const candle = candles[i];
		minP = Math.min(minP, candle.low);
		maxP = Math.max(maxP, candle.high);
		for (const series of [
			analysis.stops,
			analysis.sma,
			analysis.upper,
			analysis.lower
		]) {
			const value = series[i];
			if (Number.isFinite(value)) {
				minP = Math.min(minP, value);
				maxP = Math.max(maxP, value);
			}
		}
	}
	if (trade && trade.symbol) {
		minP = Math.min(minP, trade.sl, trade.tp);
		maxP = Math.max(maxP, trade.sl, trade.tp);
	}
	if (!Number.isFinite(minP) || !Number.isFinite(maxP) || maxP <= minP) {
		minP = 0;
		maxP = 1;
	}
	const pad = (maxP - minP) * .08 || 1;
	minP -= pad;
	maxP += pad;
	const plotL = 10;
	const plotT = 22;
	const plotB = Math.max(42, size.h - 28);
	const profileW = Math.min(108, Math.max(64, size.w * .18));
	const axisW = 72;
	const plotR = Math.max(30, size.w - 8 - profileW - axisW);
	const plotH = Math.max(1, plotB - plotT);
	const plotW = Math.max(1, plotR - plotL);
	const visible = Math.max(1, endIndex - startIndex + 1);
	const slot = plotW / visible;
	const yOf = (price) => plotT + (maxP - price) / (maxP - minP) * plotH;
	const xOf = (index) => plotL + slot * (index - startIndex) + slot / 2;
	const indexAt = (clientX) => {
		const rect = boxRef.current?.getBoundingClientRect();
		if (!rect) return null;
		const x = clientX - rect.left;
		if (x < plotL || x > plotR) return null;
		const index = startIndex + Math.floor((x - plotL) / slot);
		if (index < startIndex || index > endIndex) return null;
		return index;
	};
	const pathOf = (series) => {
		let d = "";
		let drawing = false;
		for (let i = startIndex; i <= endIndex; i += 1) {
			const value = series[i];
			if (!Number.isFinite(value)) {
				drawing = false;
				continue;
			}
			d += `${drawing ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(value).toFixed(1)}`;
			drawing = true;
		}
		return d;
	};
	const hoverCandle = hover != null ? candles[hover] : null;
	const markersHere = analysis.markers.filter((marker) => marker.index >= startIndex && marker.index <= endIndex);
	const gridPrices = [
		0,
		1,
		2,
		3
	].map((step) => maxP - (maxP - minP) * step / 3);
	const labelEvery = Math.max(1, Math.round(72 / Math.max(slot, 1)));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: boxRef,
		className: dragging ? "chart-surface relative is-drag" : "chart-surface relative",
		onDoubleClick: () => {
			setCount(130);
			setEnd(-1);
		},
		onPointerDown: (event) => {
			if (event.pointerType === "mouse" && event.button !== 0) return;
			dragRef.current = {
				x: event.clientX,
				y: event.clientY,
				end: endIndex,
				active: false
			};
		},
		onPointerMove: (event) => {
			const current = dragRef.current;
			if (!current) {
				setHover(indexAt(event.clientX));
				return;
			}
			const dx = event.clientX - current.x;
			const dy = event.clientY - current.y;
			if (!current.active) {
				const mouseDrag = event.pointerType === "mouse" && Math.abs(dx) > 4;
				const touchDrag = event.pointerType !== "mouse" && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
				if (!mouseDrag && !touchDrag) {
					setHover(indexAt(event.clientX));
					return;
				}
				current.active = true;
				setDragging(true);
			}
			const shift = Math.round(-dx / Math.max(slot, 1));
			let next = current.end + shift;
			next = Math.min(last, Math.max(viewCount - 1, next));
			setEnd(next >= last ? -1 : next);
		},
		onPointerUp: (event) => {
			const current = dragRef.current;
			dragRef.current = null;
			setDragging(false);
			if (current?.active) return;
			const index = indexAt(event.clientX);
			if (index == null) return;
			const marker = analysis.markers.find((item) => item.index === index);
			onPin(marker ? pinned === marker.index ? null : marker.index : null);
		},
		onPointerLeave: () => {
			if (!dragRef.current?.active) setHover(null);
			dragRef.current = null;
			setDragging(false);
		},
		children: [
			hoverCandle ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute left-3 top-2 z-10 font-mono text-xs text-muted",
				children: [
					formatVn(hoverCandle.time, true),
					" · O ",
					formatPx(hoverCandle.open),
					" · H ",
					formatPx(hoverCandle.high),
					" · L",
					" ",
					formatPx(hoverCandle.low),
					" · C ",
					formatPx(hoverCandle.close)
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute bottom-9 left-3 z-10 flex gap-1",
				onPointerDown: (event) => event.stopPropagation(),
				onPointerUp: (event) => event.stopPropagation(),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-11 w-11 rounded-md border border-border bg-surface text-fg",
						onClick: () => setCount((value) => Math.max(40, Math.round(value * .8))),
						"aria-label": "Phóng to",
						children: "+"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-11 w-11 rounded-md border border-border bg-surface text-fg",
						onClick: () => setCount((value) => Math.min(candles.length, Math.round(value * 1.25))),
						"aria-label": "Thu nhỏ",
						children: "−"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-11 rounded-md border border-border bg-surface px-3 text-sm text-fg",
						onClick: () => setEnd(-1),
						children: "Mới nhất"
					})
				]
			}),
			size.w > 40 && size.h > 40 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
				width: size.w,
				height: size.h,
				className: "absolute inset-0",
				role: "img",
				"aria-label": "Biểu đồ nến, UT, SMA và profile cá voi",
				children: [
					gridPrices.map((price) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: plotL,
						x2: plotR,
						y1: yOf(price),
						y2: yOf(price),
						stroke: "var(--color-border)",
						strokeDasharray: "3 4"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: plotR + 8,
						y: yOf(price) + 4,
						fill: "var(--color-muted)",
						fontSize: "11",
						fontFamily: "IBM Plex Mono, ui-monospace, monospace",
						children: formatPx(price)
					})] }, price)),
					analysis.whale.bins.map((bin, index) => {
						const y1 = yOf(bin.high);
						const y2 = yOf(bin.low);
						if (y1 > plotB || y2 < plotT) return null;
						const top = Math.max(plotT, Math.min(y1, y2));
						const height = Math.max(1, Math.min(plotB, Math.max(y1, y2)) - top);
						const mid = (bin.low + bin.high) / 2;
						const support = candles[last].close >= mid;
						const profileL = plotR + axisW;
						const profileR = size.w - 6;
						const scale = analysis.whale.maxVolume > 0 ? (profileR - profileL) / analysis.whale.maxVolume : 0;
						const weakBuy = Math.max(0, bin.buy - bin.strongBuy);
						const weakSell = Math.max(0, bin.sell - bin.strongSell);
						const parts = [
							{
								width: bin.strongBuy * scale,
								color: "var(--color-bull)",
								opacity: .95
							},
							{
								width: weakBuy * scale,
								color: "var(--color-bull)",
								opacity: .38
							},
							{
								width: weakSell * scale,
								color: "var(--color-bear)",
								opacity: .38
							},
							{
								width: bin.strongSell * scale,
								color: "var(--color-bear)",
								opacity: .95
							}
						];
						let cursor = profileR;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [bin.peak ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x: plotL,
							y: top,
							width: plotW,
							height,
							fill: support ? "var(--color-bull)" : "var(--color-bear)",
							opacity: .14
						}) : null, parts.map((part, partIndex) => {
							if (part.width < .5) return null;
							cursor -= part.width;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
								x: cursor,
								y: top,
								width: Math.max(1, part.width),
								height,
								fill: part.color,
								opacity: part.opacity
							}, partIndex);
						})] }, `bin-${index}`);
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: pathOf(analysis.lower),
						fill: "none",
						stroke: "var(--color-bull)",
						strokeOpacity: .45,
						strokeDasharray: "4 4"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: pathOf(analysis.upper),
						fill: "none",
						stroke: "var(--color-bear)",
						strokeOpacity: .45,
						strokeDasharray: "4 4"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: pathOf(analysis.sma),
						fill: "none",
						stroke: "var(--color-line)",
						strokeWidth: 1.4
					}),
					Array.from({ length: visible - 1 }, (_, offset) => {
						const index = startIndex + offset + 1;
						const prev = analysis.stops[index - 1];
						const next = analysis.stops[index];
						if (!Number.isFinite(prev) || !Number.isFinite(next)) return null;
						const up = candles[index].close >= next;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
							x1: xOf(index - 1),
							y1: yOf(prev),
							x2: xOf(index),
							y2: yOf(next),
							stroke: up ? "var(--color-bull)" : "var(--color-bear)",
							strokeWidth: 1.6
						}, `stop-${index}`);
					}),
					trade ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
							x1: plotL,
							x2: plotR,
							y1: yOf(trade.sl),
							y2: yOf(trade.sl),
							stroke: "var(--color-bear)",
							strokeDasharray: "2 3"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
							x1: plotL,
							x2: plotR,
							y1: yOf(trade.tp),
							y2: yOf(trade.tp),
							stroke: "var(--color-bull)",
							strokeDasharray: "2 3"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x: 14,
							y: yOf(trade.sl) - 4,
							fill: "var(--color-bear)",
							fontSize: "11",
							fontFamily: "IBM Plex Mono, ui-monospace, monospace",
							children: "SL"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x: 14,
							y: yOf(trade.tp) - 4,
							fill: "var(--color-bull)",
							fontSize: "11",
							fontFamily: "IBM Plex Mono, ui-monospace, monospace",
							children: "TP"
						})
					] }) : null,
					candles.slice(startIndex, endIndex + 1).map((candle, offset) => {
						const index = startIndex + offset;
						const color = candle.close >= candle.open ? "var(--color-bull)" : "var(--color-bear)";
						const x = xOf(index);
						const bodyW = Math.max(1, Math.min(14, slot * .64));
						const top = Math.min(yOf(candle.open), yOf(candle.close));
						const height = Math.max(1, Math.abs(yOf(candle.close) - yOf(candle.open)));
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
							x1: x,
							x2: x,
							y1: yOf(candle.high),
							y2: yOf(candle.low),
							stroke: color,
							strokeWidth: 1
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
							x: x - bodyW / 2,
							y: top,
							width: bodyW,
							height,
							fill: color
						})] }, candle.time);
					}),
					analysis.wyckoffRange ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: Math.max(plotL, xOf(analysis.wyckoffRange.left)),
						y: yOf(analysis.wyckoffRange.high),
						width: Math.max(0, Math.min(plotR, xOf(analysis.wyckoffRange.right)) - Math.max(plotL, xOf(analysis.wyckoffRange.left))),
						height: Math.max(1, yOf(analysis.wyckoffRange.low) - yOf(analysis.wyckoffRange.high)),
						fill: analysis.wyckoffRange.dir === 1 ? "var(--color-bull)" : "var(--color-bear)",
						opacity: .08,
						stroke: analysis.wyckoffRange.dir === 1 ? "var(--color-bull)" : "var(--color-bear)",
						strokeOpacity: .45
					}) : null,
					analysis.wyckoffEvents.filter((event) => event.index >= startIndex && event.index <= endIndex).map((event) => {
						const x = xOf(event.index);
						const up = event.dir === 1;
						const y = up ? yOf(event.price) + 12 : yOf(event.price) - 6;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x,
							y,
							textAnchor: "middle",
							fill: up ? "var(--color-bull)" : "var(--color-bear)",
							fontSize: "10",
							fontFamily: "IBM Plex Mono, ui-monospace, monospace",
							children: event.name
						}, `${event.index}-${event.name}-${event.dir}`);
					}),
					markersHere.map((marker) => {
						const candle = candles[marker.index];
						const x = xOf(marker.index);
						const long = marker.side === "LONG";
						const y = long ? yOf(candle.low) + 14 : yOf(candle.high) - 14;
						const color = marker.tier === "filtered" ? "var(--color-muted)" : marker.tier === "partial" ? "var(--color-line)" : long ? "var(--color-bull)" : "var(--color-bear)";
						const tip = long ? `${x - 5},${y + 6} ${x + 5},${y + 6} ${x},${y - 4}` : `${x - 5},${y - 6} ${x + 5},${y - 6} ${x},${y + 4}`;
						const selected = pinned === marker.index;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
							selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
								cx: x,
								cy: y,
								r: 11,
								fill: "none",
								stroke: "var(--color-fg)"
							}) : null,
							marker.tier === "filtered" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
								cx: x,
								cy: long ? yOf(candle.low) + 8 : yOf(candle.high) - 8,
								r: 2.5,
								fill: color
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
								points: tip,
								fill: color,
								opacity: marker.provisional ? .55 : 1
							}),
							marker.tier === "confirmed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
								x,
								y: long ? y + 18 : y - 12,
								textAnchor: "middle",
								fill: color,
								fontSize: "10",
								fontFamily: "IBM Plex Mono, ui-monospace, monospace",
								children: marker.provisional ? "TẠM" : marker.side
							}) : null
						] }, `${marker.index}-${marker.side}`);
					}),
					hover != null && hover >= startIndex && hover <= endIndex ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: xOf(hover),
						x2: xOf(hover),
						y1: plotT,
						y2: plotB,
						stroke: "var(--color-muted)",
						strokeDasharray: "2 3"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: plotR + axisW,
						x2: plotR + axisW,
						y1: plotT,
						y2: plotB,
						stroke: "var(--color-border)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: plotR + axisW + 4,
						y: 34,
						fill: "var(--color-muted)",
						fontSize: "10",
						fontFamily: "IBM Plex Mono, ui-monospace, monospace",
						children: "Cá voi"
					}),
					Array.from({ length: visible }, (_, offset) => startIndex + offset).filter((index) => (index - startIndex) % labelEvery === 0).map((index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: xOf(index),
						y: size.h - 8,
						textAnchor: "middle",
						fill: "var(--color-muted)",
						fontSize: "10",
						fontFamily: "IBM Plex Mono, ui-monospace, monospace",
						children: formatVn(candles[index].time, visible < 80)
					}, `t-${index}`))
				]
			}) : null
		]
	});
}
function toneClass(tone) {
	if (tone === "bull") return "text-bull";
	if (tone === "bear") return "text-bear";
	if (tone === "wait") return "text-line";
	return "text-muted";
}
function stateMark(state) {
	if (state === "pass") return "bg-bull";
	if (state === "fail") return "bg-bear";
	return "bg-line";
}
function SignalDock({ focus, analysis, pinned, onClearPin, intervalWarning }) {
	const whale = analysis.whale;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-md border border-border bg-surface",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3 border-b border-border px-3 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: focus.kicker
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `font-mono text-3xl font-semibold tracking-tight ${toneClass(focus.tone)}`,
						children: focus.headline
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-fg",
						children: focus.sub
					}),
					focus.time ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 font-mono text-xs text-muted",
						children: [formatVn(focus.time, true), " VN"]
					}) : null
				] }), pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "h-11 shrink-0 rounded-md border border-border px-3 text-sm text-fg",
					onClick: onClearPin,
					children: "Về hiện tại"
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col gap-2 px-3 py-3",
				children: focus.checks.map((check) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `mt-1 size-2.5 shrink-0 rounded-full ${stateMark(check.state)}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-fg",
						children: check.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: check.text
					})] })]
				}, check.label))
			}),
			focus.entry != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 gap-2 border-t border-border px-3 py-3 font-mono text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Level, {
						label: "Vào",
						value: formatPx(focus.entry)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Level, {
						label: "SL",
						value: formatPx(focus.sl ?? NaN),
						className: "text-bear"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Level, {
						label: "TP",
						value: formatPx(focus.tp ?? NaN),
						className: "text-bull"
					}),
					focus.planNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "col-span-3 font-sans text-xs text-muted",
						children: focus.planNote
					}) : null
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-border px-3 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Profile cá voi hiện tại"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "mt-2 grid grid-cols-2 gap-2 font-mono text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Delta quanh giá",
							v: formatVol(whale.deltaNear)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Delta cửa sổ",
							v: formatVol(whale.profileDelta)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Đỡ gần",
							v: whale.support ? formatPx(whale.support.mid) : "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Cản gần",
							v: whale.resistance ? formatPx(whale.resistance.mid) : "—"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "border-t border-border px-3 py-3 text-sm text-muted",
				children: [
					"Cửa sổ này: ",
					analysis.counts.confirmedLong,
					" LONG · ",
					analysis.counts.confirmedShort,
					" SHORT đã vào sổ ·",
					" ",
					analysis.counts.partial,
					" chờ cổng · ",
					analysis.counts.filtered,
					" bị SMA loại.",
					analysis.lastConfirmed ? ` Lần ghi sổ gần nhất ${analysis.lastConfirmed.side} lúc ${formatVn(analysis.lastConfirmed.time, true)}.` : ""
				]
			}),
			intervalWarning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-3 pb-3 text-sm text-line",
				children: "Khung 4 giờ làm thống kê theo giờ rất thưa. Nên xem 15 phút hoặc 1 giờ."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-3 pb-3 text-xs text-muted",
				children: "UT theo strategy. Wyckoff là sơ đồ tích lũy hoặc phân phối trên đúng khung nến. Phiên và cá voi chỉ loại khi thuận chiều quá rõ. Sổ lệnh là giấy, không phải lệnh thật và không phải lời khuyên đầu tư."
			})
		]
	});
}
function Level({ label, value, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "font-sans text-xs text-muted",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: className ?? "text-fg",
		children: value
	})] });
}
function Stat({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
		className: "font-sans text-xs text-muted",
		children: k
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
		className: "text-fg",
		children: v
	})] });
}
function SessionPanel({ analysis, nowMs }) {
	const hours = analysis?.hours ?? [];
	const candleHour = analysis?.live.time != null ? hourOf(analysis.live.time) : nowMs != null ? hourOf(nowMs) : null;
	const ranked = [...analysis?.sessions ?? []].sort((a, b) => (a.rank || 99) - (b.rank || 99));
	const best = [...hours.filter((hour) => hour.qualified && Number.isFinite(hour.score))].sort((a, b) => b.score - a.score)[0];
	const avoid = [...hours].filter((hour) => hour.qualified).sort((a, b) => a.range - b.range)[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-md border border-border bg-surface p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold text-fg",
					children: "Phiên"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs text-muted",
					children: "UTC"
				})]
			}),
			analysis ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: [
					"Nến này: ",
					analysis.sessionsNow.length ? analysis.sessionsNow.join(" · ") : "ngoài phiên",
					analysis.overlap ? " · giao London × New York" : ""
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Đang chờ nến để xếp phiên."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-3 text-sm font-semibold text-fg",
				children: "Giờ trong ngày"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-xs text-muted",
				children: [best ? `Tập trung ${String(best.hour).padStart(2, "0")}:00` : "Chưa đủ mẫu", avoid ? ` · tránh ${String(avoid.hour).padStart(2, "0")}:00` : ""]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 grid grid-cols-8 gap-1",
				children: hours.map((hour) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HourCell, {
					hour,
					active: hour.hour === candleHour
				}, hour.hour))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-col gap-1",
				children: ranked.map((session) => {
					const active = analysis?.sessionsNow.includes(session.name);
					const window = SESSIONS.find((item) => item.id === session.id);
					const label = window ? `${String(window.start).padStart(2, "0")}:00–${String(window.end).padStart(2, "0")}:00` : "";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `rounded-sm border px-2 py-1.5 ${active ? "border-bull bg-surface-2" : "border-border"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm text-fg",
								children: [session.name, active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-bull",
									children: " · mở"
								}) : null]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-xs text-muted",
								children: session.rank ? `#${session.rank}` : "—"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-xs text-muted",
							children: [
								label,
								" · biên ",
								Number.isFinite(session.range) ? `${session.range.toFixed(2)}%` : "—",
								" · bull",
								" ",
								Number.isFinite(session.bull) ? `${session.bull.toFixed(0)}%` : "—",
								" · drift ",
								formatPct(session.drift, 3)
							]
						})]
					}, session.id);
				})
			})
		]
	});
}
function HourCell({ hour, active }) {
	const up = Number.isFinite(hour.bull) && hour.bull >= 50;
	const strength = Number.isFinite(hour.bull) ? Math.min(1, Math.abs(hour.bull - 50) / 25) : 0;
	const title = hour.qualified ? `${String(hour.hour).padStart(2, "0")}:00 UTC · bull ${hour.bull.toFixed(0)}% · drift ${hour.drift.toFixed(3)}% · biên ${hour.range.toFixed(3)}% · hạng biên ${hour.rangeRank}` : `${String(hour.hour).padStart(2, "0")}:00 UTC · ${hour.bars} nến`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-8 overflow-hidden rounded-sm bg-surface-2",
		title,
		children: [
			hour.qualified ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `absolute inset-0 ${up ? "bg-bull" : "bg-bear"}`,
				style: { opacity: .2 + strength * .65 }
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "relative flex h-full items-center justify-center font-mono text-xs text-fg",
				children: String(hour.hour).padStart(2, "0")
			}),
			active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pointer-events-none absolute inset-0 rounded-sm ring-1 ring-fg" }) : null
		]
	});
}
function Journal({ rows, marks, onOpen, onClear }) {
	const closed = rows.filter((row) => row.status !== "open");
	const wins = closed.filter((row) => row.status === "tp").length;
	const winRate = closed.length ? wins / closed.length * 100 : NaN;
	const sum = closed.reduce((total, row) => total + (pnlPct(row) || 0), 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-md border border-border bg-surface",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-semibold text-fg",
				children: "Sổ giấy"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-mono text-xs text-muted",
				children: [
					"Chỉ lệnh qua các cổng đang bật · đóng ",
					closed.length,
					" · thắng",
					" ",
					Number.isFinite(winRate) ? `${winRate.toFixed(0)}%` : "—",
					" · tổng ",
					formatPct(closed.length ? sum : NaN),
					" chưa phí"
				]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "h-11 rounded-md border border-border px-3 text-sm text-muted",
				onClick: onClear,
				children: "Xóa sổ"
			})]
		}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-3 py-3 text-sm text-muted",
			children: "Chưa có lệnh. Sổ chỉ ghi sau nến đóng, khi Wyckoff không ngược sơ đồ và các cổng đang bật không chặn."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "max-h-64 divide-y divide-border overflow-auto xl:hidden",
			children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "flex w-full items-center justify-between gap-3 px-3 py-2 text-left",
				onClick: () => onOpen(row.symbol),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: `font-mono text-sm ${row.side === "LONG" ? "text-bull" : "text-bear"}`,
						children: [
							row.side,
							" ",
							row.symbol
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block font-mono text-xs text-muted",
						children: [
							formatVn(row.signalTime, true),
							" · vào ",
							formatPx(row.entry)
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GateNotes, { row })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TradeResult, {
					row,
					mark: marks[`${row.symbol}|${row.interval}`]
				})]
			}) }, row.id))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "hidden max-h-40 overflow-auto xl:block",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full text-left text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "text-xs text-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-2 font-medium",
							children: "Thời gian"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 font-medium",
							children: "Cặp"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 font-medium",
							children: "Lệnh"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 font-medium",
							children: "Vào"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 font-medium",
							children: "SL"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 font-medium",
							children: "TP"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 font-medium",
							children: "Kết"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-t border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "px-3 py-2 font-mono text-xs text-muted",
							children: [formatVn(row.signalTime, true), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GateNotes, { row })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "font-mono text-fg",
								onClick: () => onOpen(row.symbol),
								children: row.symbol
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: `px-2 py-2 font-mono ${row.side === "LONG" ? "text-bull" : "text-bear"}`,
							children: row.side
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2 font-mono",
							children: formatPx(row.entry)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2 font-mono text-bear",
							children: formatPx(row.sl)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2 font-mono text-bull",
							children: formatPx(row.tp)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TradeResult, {
								row,
								mark: marks[`${row.symbol}|${row.interval}`]
							})
						})
					]
				}, row.id)) })]
			})
		})] })]
	});
}
function GateNotes({ row }) {
	if (!row.sessionNote && !row.whaleNote && !row.wyckoffNote) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "mt-0.5 block font-mono text-xs leading-snug text-muted",
		children: [
			row.wyckoffNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "block",
				children: ["Wyckoff · ", row.wyckoffNote]
			}) : null,
			row.sessionNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "block",
				children: ["Phiên đạt · ", row.sessionNote]
			}) : null,
			row.whaleNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "block",
				children: ["Cá voi đạt · ", row.whaleNote]
			}) : null
		]
	});
}
function TradeResult({ row, mark }) {
	const value = pnlPct(row, mark);
	const label = row.status === "tp" ? "TP" : row.status === "sl" ? "SL" : "Mở";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `font-mono text-sm ${!Number.isFinite(value) ? "text-muted" : value >= 0 ? "text-bull" : "text-bear"}`,
		children: [
			label,
			" ",
			formatPct(value)
		]
	});
}
function Settings({ params, onChange, onReset }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
		className: "group rounded-md border border-border bg-surface",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
			className: "flex h-11 cursor-pointer list-none items-center justify-between px-3 text-sm text-fg",
			children: [
				"Thông số UT, SMA, Wyckoff, phiên, cá voi",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted group-open:hidden",
					children: "Mở"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden text-muted group-open:inline",
					children: "Đóng"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-3 px-3 pb-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "UT key",
					value: params.utKey,
					step: .1,
					onChange: (utKey) => onChange({ utKey })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "ATR",
					value: params.atrPeriod,
					onChange: (atrPeriod) => onChange({ atrPeriod })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "SMA",
					value: params.smaLen,
					onChange: (smaLen) => onChange({ smaLen })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "Cách SMA %",
					value: params.smaDist,
					step: .01,
					onChange: (smaDist) => onChange({ smaDist })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "Nhìn lại N nến",
					value: params.smaLook,
					onChange: (smaLook) => onChange({ smaLook })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "SL %",
					value: params.slPct,
					step: .1,
					onChange: (slPct) => onChange({ slPct })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "TP %",
					value: params.tpPct,
					step: .1,
					onChange: (tpPct) => onChange({ tpPct })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "Cá voi lookback",
					value: params.whaleLookback,
					onChange: (whaleLookback) => onChange({ whaleLookback })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "Số bin",
					value: params.whaleBins,
					onChange: (whaleBins) => onChange({ whaleBins })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "Ngưỡng mạnh %",
					value: params.strengthPct,
					onChange: (strengthPct) => onChange({ strengthPct })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "Tối thiểu nến / giờ",
					value: params.sessionMinBars,
					onChange: (sessionMinBars) => onChange({ sessionMinBars })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "Bull tối thiểu LONG",
					value: params.bullMin,
					step: 1,
					onChange: (bullMin) => onChange({ bullMin })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
					label: "Bull tối đa SHORT",
					value: params.bearMax,
					onChange: (bearMax) => onChange({ bearMax })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					label: "Bắt buộc cách SMA",
					on: params.requireSma,
					onClick: () => onChange({ requireSma: !params.requireSma })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					label: "Đo bằng high/low",
					on: params.useExtreme,
					onClick: () => onChange({ useExtreme: !params.useExtreme })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					label: "Bắt buộc Wyckoff",
					on: params.requireWyckoff,
					onClick: () => onChange({ requireWyckoff: !params.requireWyckoff })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					label: "Bắt buộc phiên",
					on: params.requireSession,
					onClick: () => onChange({ requireSession: !params.requireSession })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					label: "Bắt buộc cá voi",
					on: params.requireWhale,
					onClick: () => onChange({ requireWhale: !params.requireWhale })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "col-span-2 h-11 rounded-md border border-border text-sm text-muted",
					onClick: onReset,
					children: "Đưa thông số về mặc định strategy"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "col-span-2 text-xs text-muted",
					children: "Sổ giấy vào lệnh khi nến đã đóng và mọi cổng đang bật cùng cho. Wyckoff chỉ chặn khi sơ đồ đã tới Spring/SOS hoặc UT/SOW và lệnh đi ngược chiều đó. Trước đó sơ đồ chỉ hiển thị, không chặn. Phiên và cá voi chỉ chặn khi thuận chiều quá rõ. Tắt công tắc thì cổng đó không chặn sổ."
				})
			]
		})]
	});
}
function Num({ label, value, step = 1, onChange }) {
	const decimal = step < 1;
	const [draft, setDraft] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "flex flex-col gap-1 text-sm text-muted",
		children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			className: "h-11 rounded-md border border-border bg-bg px-2 font-mono text-base text-fg",
			inputMode: decimal ? "decimal" : "numeric",
			type: "text",
			autoComplete: "off",
			value: draft ?? (Number.isFinite(value) ? String(value) : ""),
			onChange: (event) => {
				const raw = event.target.value;
				const body = raw.replace(",", ".");
				const ok = decimal ? /^\d*\.?\d*$/.test(body) : /^\d*$/.test(body);
				if (raw !== "" && !ok) return;
				setDraft(raw);
				if (body === "" || body === "." || body.endsWith(".")) return;
				const next = Number(body);
				if (Number.isFinite(next)) onChange(next);
			},
			onBlur: () => setDraft(null)
		})]
	});
}
function Toggle({ label, on, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		role: "switch",
		"aria-checked": on,
		onClick,
		className: "col-span-2 flex h-11 items-center justify-between rounded-md border border-border bg-bg px-3 text-sm text-fg",
		children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `rounded-sm px-2 py-1 font-mono text-xs ${on ? "bg-bull text-ink" : "bg-surface-2 text-muted"}`,
			children: on ? "Bật" : "Tắt"
		})]
	});
}
function signature(rows) {
	return rows.map((row) => `${row.id}:${row.status}:${row.exit ?? ""}:${row.sl}:${row.tp}:${row.sessionNote ?? ""}:${row.whaleNote ?? ""}`).join("|");
}
function badgeLabel(headline) {
	if (headline === "TẠM LONG" || headline === "TẠM SHORT") return "TẠM";
	return headline;
}
function applyBoard(prev, incoming, symbols) {
	const map = new Map(prev?.rows.map((row) => [row.symbol, row]) ?? []);
	for (const row of incoming.rows) map.set(row.symbol, row);
	return {
		rows: symbols.flatMap((symbol) => {
			const row = map.get(symbol);
			return row ? [row] : [];
		}),
		fetchedAt: incoming.fetchedAt
	};
}
function Desk() {
	const symbols = useDesk((state) => state.symbols);
	const active = useDesk((state) => state.active);
	const interval = useDesk((state) => state.interval);
	const storedParams = useDesk((state) => state.params);
	const journal = useDesk((state) => state.journal);
	const hydrated = useDesk((state) => state.hydrated);
	const params = (0, import_react.useMemo)(() => clampParams({
		...defaultParams,
		...storedParams
	}), [storedParams]);
	const [board, setBoard] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [tick, setTick] = (0, import_react.useState)(0);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [formError, setFormError] = (0, import_react.useState)(null);
	const [pinned, setPinned] = (0, import_react.useState)(null);
	const [now, setNow] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let alive = true;
		Promise.resolve(useDesk.persist.rehydrate()).finally(() => {
			if (alive) useDesk.setState({ hydrated: true });
		});
		return () => {
			alive = false;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const id = setInterval(() => setNow(Date.now()), 1e3);
		setNow(Date.now());
		return () => clearInterval(id);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		if (!symbols.includes(active) && symbols[0]) useDesk.getState().setActive(symbols[0]);
	}, [
		hydrated,
		symbols,
		active
	]);
	(0, import_react.useEffect)(() => {
		setPinned(null);
	}, [active, interval]);
	const missingKey = symbols.filter((symbol) => !board?.rows.some((row) => row.symbol === symbol)).join("|");
	(0, import_react.useEffect)(() => {
		setBoard(null);
	}, [interval]);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		let cancel = false;
		const run = async (background) => {
			const requestedInterval = useDesk.getState().interval;
			const requested = useDesk.getState().symbols;
			if (!background) setLoading(true);
			try {
				const next = await fetchBoard({ data: {
					symbols: requested,
					interval: requestedInterval,
					limit: 500
				} });
				if (cancel || useDesk.getState().interval !== requestedInterval) return;
				setBoard((prev) => applyBoard(prev, next, useDesk.getState().symbols));
				setError(null);
			} catch (err) {
				if (!cancel) setError(err instanceof Error ? err.message : "Không tải được dữ liệu");
			} finally {
				if (!cancel && !background) setLoading(false);
			}
		};
		run(false);
		const timer = setInterval(() => void run(true), 25e3);
		return () => {
			cancel = true;
			clearInterval(timer);
		};
	}, [
		hydrated,
		interval,
		tick
	]);
	(0, import_react.useEffect)(() => {
		if (!hydrated || !board || !missingKey) return;
		let cancel = false;
		const requestedInterval = interval;
		const missing = missingKey.split("|");
		(async () => {
			try {
				const next = await fetchBoard({ data: {
					symbols: missing,
					interval: requestedInterval,
					limit: 500
				} });
				if (cancel || useDesk.getState().interval !== requestedInterval) return;
				setBoard((prev) => applyBoard(prev, next, useDesk.getState().symbols));
				setError(null);
			} catch (err) {
				if (!cancel) setError(err instanceof Error ? err.message : "Không tải được dữ liệu");
			}
		})();
		return () => {
			cancel = true;
		};
	}, [
		hydrated,
		missingKey,
		interval
	]);
	const analyses = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		if (!board) return map;
		for (const row of board.rows) if (row.candles.length > 0) map.set(row.symbol, analyze(row.candles, params, interval));
		return map;
	}, [board, params]);
	(0, import_react.useEffect)(() => {
		if (!board) return;
		const fresh = board.rows.flatMap((row) => {
			const found = analyses.get(row.symbol);
			if (!found) return [];
			return papersFrom(row.symbol, interval, row.candles, found, params);
		});
		const covered = board.rows.filter((row) => analyses.has(row.symbol)).map((row) => `${row.symbol}|${interval}`);
		const prev = Array.isArray(useDesk.getState().journal) ? useDesk.getState().journal : [];
		const next = mergeJournal(prev, fresh, covered);
		if (signature(prev) !== signature(next)) useDesk.getState().setJournal(next);
	}, [
		board,
		analyses,
		interval,
		params
	]);
	const activeRow = board?.rows.find((row) => row.symbol === active) ?? null;
	const candles = activeRow?.candles ?? [];
	const analysis = analyses.get(active) ?? null;
	const pinnedMarker = analysis?.markers.find((marker) => marker.index === pinned) ?? null;
	const focus = pinnedMarker ? focusOfMarker(pinnedMarker, candles, params) : analysis?.live ?? null;
	const safeJournal = Array.isArray(journal) ? journal : [];
	const openTrade = safeJournal.find((row) => row.symbol === active && row.interval === interval && row.status === "open") ?? null;
	const delta = candles.length ? changePct(candles, interval) : NaN;
	const marks = {};
	for (const row of board?.rows ?? []) {
		const last = row.candles[row.candles.length - 1];
		if (last) marks[`${row.symbol}|${interval}`] = last.close;
	}
	const clock = now ? formatClock(now) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "desk",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-wrap items-center gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
						viewBox: "0 0 32 32",
						className: "size-8",
						"aria-hidden": true,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
								x: "2",
								y: "14",
								width: "6",
								height: "16",
								rx: "1",
								fill: "var(--color-line)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
								x: "13",
								y: "4",
								width: "6",
								height: "26",
								rx: "1",
								fill: "var(--color-bull)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
								x: "24",
								y: "10",
								width: "6",
								height: "20",
								rx: "1",
								fill: "var(--color-bear)"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-lg font-semibold tracking-tight text-fg",
						children: "ORCA"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "UT · Wyckoff · Phiên · Cá voi"
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1",
					role: "group",
					"aria-label": "Khung thời gian",
					children: INTERVALS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": item === interval,
						className: `h-11 rounded-md px-3 font-mono text-sm ${item === interval ? "bg-bull text-ink" : "bg-surface text-muted"}`,
						onClick: () => useDesk.getState().setInterval(item),
						children: INTERVAL_LABEL[item]
					}, item))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right font-mono text-xs text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["VN ", clock ? clock.vn : "—"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["UTC ", clock ? clock.utc : "—"] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-fg",
						onClick: () => setTick((value) => value + 1),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: loading ? "size-4 animate-spin" : "size-4" }), "Làm mới"]
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "desk-body",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "rail flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-md border border-border bg-surface p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-sm font-semibold text-fg",
									children: "Cặp theo dõi"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
									className: "mt-2 flex gap-2",
									onSubmit: (event) => {
										event.preventDefault();
										const message = useDesk.getState().addSymbol(draft);
										setFormError(message);
										if (!message) setDraft("");
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										"aria-label": "Thêm cặp",
										placeholder: "Thêm SOL, ETH…",
										value: draft,
										onChange: (event) => setDraft(event.target.value),
										className: "h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-base text-fg"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "h-11 rounded-md bg-bull px-3 text-sm font-medium text-ink",
										children: "Thêm"
									})]
								}),
								formError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm text-bear",
									children: formError
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-2 flex flex-col",
									children: symbols.map((symbol) => {
										const row = board?.rows.find((item) => item.symbol === symbol);
										const view = analyses.get(symbol);
										const price = row?.candles[row.candles.length - 1]?.close;
										const change = row && row.candles.length ? changePct(row.candles, interval) : NaN;
										const headline = view?.live.headline ?? (row?.error ? "LỖI" : "…");
										const tone = view?.live.tone ?? "muted";
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex items-stretch",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => useDesk.getState().setActive(symbol),
												className: `flex min-h-14 flex-1 items-center justify-between gap-2 border-l-2 py-2 pl-2 text-left ${symbol === active ? "border-bull bg-surface-2" : "border-transparent"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "block font-mono text-sm text-fg",
													children: symbol
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono text-xs text-muted",
													children: [
														price ? formatPx(price) : row ? "—" : "…",
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: change > 0 ? "text-bull" : change < 0 ? "text-bear" : "",
															children: formatPct(change)
														})
													]
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: `font-mono text-xs ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : tone === "wait" ? "text-line" : "text-muted"}`,
													children: badgeLabel(headline)
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": `Xóa ${symbol}`,
												className: "h-14 w-11 text-sm text-muted",
												onClick: () => useDesk.getState().removeSymbol(symbol),
												children: "×"
											})]
										}, symbol);
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 text-xs text-muted",
									children: [board ? `Cập nhật ${formatVn(board.fetchedAt)} VN` : hydrated ? "Đang kéo nến Binance…" : "Đang mở bàn…", error ? ` · ${error}` : ""]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionPanel, {
							analysis,
							nowMs: now
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-1 text-xs text-muted",
							children: "Mô phỏng trên nến Binance. Không đặt lệnh thật."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "stage",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-mono text-base text-fg",
									children: active
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-sm text-fg",
									children: [candles.length ? formatPx(candles[candles.length - 1].close) : "—", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `ml-2 ${delta > 0 ? "text-bull" : delta < 0 ? "text-bear" : "text-muted"}`,
										children: formatPct(delta)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: "Tam giác đậm: đủ ba cổng. Vàng: thiếu cổng. Chấm: UT bị SMA loại. Dải ngang: hấp thụ."
								})
							]
						}), analysis && candles.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceChart, {
							resetKey: `${active}|${interval}`,
							candles,
							analysis,
							trade: openTrade,
							pinned,
							onPin: setPinned
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "chart-surface flex items-center justify-center bg-bg px-6 text-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "max-w-sm text-sm text-muted",
								children: activeRow?.error ? activeRow.error : !activeRow || loading || !hydrated ? "Đang kéo nến và dựng stop UT, dải SMA, phiên và profile cá voi." : "Chưa có nến cho cặp này."
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Journal, {
						rows: safeJournal,
						marks,
						onOpen: (symbol) => useDesk.getState().setActive(symbol),
						onClear: () => useDesk.getState().clearJournal()
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "dock flex flex-col gap-3",
					children: [focus && analysis ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignalDock, {
						focus,
						analysis,
						pinned: pinnedMarker != null,
						onClearPin: () => setPinned(null),
						intervalWarning: interval === "4h"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "rounded-md border border-border bg-surface px-3 py-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: loading ? "Đang tính tín hiệu…" : "Chọn một cặp có nến để xem UT, phiên và cá voi."
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, {
						params,
						onChange: (patch) => useDesk.getState().setParams(patch),
						onReset: () => useDesk.getState().resetParams()
					})]
				})
			]
		})]
	});
}
var SplitComponent = Desk;
//#endregion
export { SplitComponent as component };
