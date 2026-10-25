import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { t as INTERVALS } from "./engine-B2WEO6yo.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/market-BfzzFXHZ.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var cache = /* @__PURE__ */ new Map();
var TTL_MS = 15e3;
async function loadOne(symbol, interval, limit) {
	const key = `${symbol}|${interval}|${limit}`;
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < TTL_MS) return hit.candles;
	const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
	let res;
	try {
		res = await fetch(url, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(12e3)
		});
	} catch {
		throw new Error("Không nối được tới Binance");
	}
	if (!res.ok) throw new Error(res.status === 400 ? "Không có cặp này trên Binance" : "Binance không trả dữ liệu");
	const rows = await res.json();
	if (!Array.isArray(rows)) throw new Error("Dữ liệu nến lỗi");
	const candles = [];
	for (const row of rows) {
		if (!Array.isArray(row) || row.length < 6) continue;
		const candle = {
			time: Number(row[0]),
			open: Number(row[1]),
			high: Number(row[2]),
			low: Number(row[3]),
			close: Number(row[4]),
			volume: Number(row[5])
		};
		if ([
			candle.time,
			candle.open,
			candle.high,
			candle.low,
			candle.close,
			candle.volume
		].every(Number.isFinite)) candles.push(candle);
	}
	cache.set(key, {
		at: Date.now(),
		candles
	});
	return candles;
}
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
var fetchBoard_createServerFn_handler = createServerRpc({
	id: "75d2a007761a0e4420b8f8f57d0d3973db207906086d2400df577767f21dbfca",
	name: "fetchBoard",
	filename: "src/lib/market.ts"
}, (opts) => fetchBoard.__executeServer(opts));
var fetchBoard = createServerFn({ method: "POST" }).validator((input) => parseBoard(input)).handler(fetchBoard_createServerFn_handler, async ({ data }) => {
	return {
		rows: await Promise.all(data.symbols.map(async (symbol) => {
			try {
				const candles = await loadOne(symbol, data.interval, data.limit);
				if (candles.length === 0) return {
					symbol,
					candles,
					error: "Không có nến"
				};
				return {
					symbol,
					candles,
					error: null
				};
			} catch (err) {
				return {
					symbol,
					candles: [],
					error: err instanceof Error ? err.message : "Không tải được"
				};
			}
		})),
		fetchedAt: Date.now()
	};
});
//#endregion
export { fetchBoard_createServerFn_handler };
