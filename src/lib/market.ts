import { createServerFn } from "@tanstack/react-start";
import { analyze, clampParams, INTERVALS, papersFrom, pnlPct, type Candle, type Interval, type Params } from "@/lib/engine";

export type BoardRow = { symbol: string; candles: Candle[]; error: string | null };
export type Board = { rows: BoardRow[]; fetchedAt: number };

const cache = new Map<string, { at: number; candles: Candle[] }>();
const TTL_MS = 15_000;

async function loadOne(symbol: string, interval: Interval, limit: number): Promise<Candle[]> {
  const key = `${symbol}|${interval}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.candles;
  const pageSize = 1000;
  const chunks: Candle[][] = [];
  let end: number | undefined;
  let left = limit;
  while (left > 0) {
    const size = Math.min(pageSize, left);
    const url = new URL("https://data-api.binance.vision/api/v3/klines");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(size));
    if (end) url.searchParams.set("endTime", String(end - 1));
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new Error("Không nối được tới Binance");
    }
    if (!res.ok) {
      throw new Error(res.status === 400 ? "Không có cặp này trên Binance" : "Binance không trả dữ liệu");
    }
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) throw new Error("Dữ liệu nến lỗi");
    const candles: Candle[] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 6) continue;
      const candle: Candle = {
        time: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      };
      if ([candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) {
        candles.push(candle);
      }
    }
    if (candles.length === 0) break;
    chunks.unshift(candles);
    left -= candles.length;
    if (candles.length < size) break;
    end = candles[0].time;
  }
  const merged = new Map<number, Candle>();
  for (const candle of chunks.flat()) merged.set(candle.time, candle);
  const candles = [...merged.values()].sort((a, b) => a.time - b.time).slice(-limit);
  cache.set(key, { at: Date.now(), candles });
  return candles;
}

function parseBoard(input: unknown): { symbols: string[]; interval: Interval; limit: number } {
  if (!input || typeof input !== "object") throw new Error("Thiếu dữ liệu");
  const raw = input as { symbols?: unknown; interval?: unknown; limit?: unknown };
  if (!Array.isArray(raw.symbols) || raw.symbols.length < 1 || raw.symbols.length > 40) {
    throw new Error("Danh sách cặp không hợp lệ");
  }
  const symbols = raw.symbols.map((symbol) => {
    if (typeof symbol !== "string" || !/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error("Mã cặp không hợp lệ");
    return symbol;
  });
  if (typeof raw.interval !== "string" || !(INTERVALS as readonly string[]).includes(raw.interval)) {
    throw new Error("Khung thời gian không hợp lệ");
  }
  const limit =
    typeof raw.limit === "number" && Number.isFinite(raw.limit)
      ? Math.min(2000, Math.max(50, Math.floor(raw.limit)))
      : 500;
  return { symbols, interval: raw.interval as Interval, limit };
}

export const fetchBoard = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseBoard(input))
  .handler(async ({ data }) => {
    const rows: BoardRow[] = [];
    const queue = [...data.symbols];
    const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length > 0) {
        const symbol = queue.shift();
        if (!symbol) break;
        try {
          const candles = await loadOne(symbol, data.interval, data.limit);
          rows.push(candles.length === 0 ? { symbol, candles, error: "Không có nến" } : { symbol, candles, error: null });
        } catch (err) {
          const error = err instanceof Error ? err.message : "Không tải được";
          rows.push({ symbol, candles: [], error });
        }
      }
    });
    await Promise.all(workers);
    return { rows, fetchedAt: Date.now() } satisfies Board;
  });

const BAR_MS: Record<Interval, number> = { "5m": 300_000, "15m": 900_000, "30m": 1_800_000, "1h": 3_600_000, "4h": 14_400_000 };
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

function tradableUsdt(symbol: string): boolean {
  if (!symbol.endsWith("USDT")) return false;
  if (/(UP|DOWN|BULL|BEAR)USDT$/.test(symbol)) return false;
  const skip = new Set(["USDCUSDT", "FDUSDUSDT", "TUSDUSDT", "BUSDUSDT", "EURUSDT", "AEURUSDT", "USDPUSDT", "DAIUSDT"]);
  return !skip.has(symbol);
}

export type ScanHit = { symbol: string; trades: number; win: number; sum: number; volume: number };

export const scanPairs = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Thiếu dữ liệu");
    const raw = input as { interval?: unknown; params?: unknown };
    if (typeof raw.interval !== "string" || !(INTERVALS as readonly string[]).includes(raw.interval)) {
      throw new Error("Khung thời gian không hợp lệ");
    }
    return { interval: raw.interval as Interval, params: clampParams(raw.params as Params) };
  })
  .handler(async ({ data }) => {
    const tickerRes = await fetch("https://data-api.binance.vision/api/v3/ticker/24hr", {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!tickerRes.ok) throw new Error("Không lấy được khối lượng Binance");
    const ticker: unknown = await tickerRes.json();
    if (!Array.isArray(ticker)) throw new Error("Khối lượng không hợp lệ");
    const top = ticker
      .flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as { symbol?: unknown; quoteVolume?: unknown };
        if (typeof item.symbol !== "string" || !tradableUsdt(item.symbol)) return [];
        const volume = Number(item.quoteVolume);
        if (!Number.isFinite(volume) || volume <= 0) return [];
        return [{ symbol: item.symbol, volume }];
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 100);
    const bars = Math.ceil(THREE_DAYS / BAR_MS[data.interval]);
    const limit = Math.min(1000, bars + 220);
    const cutoff = Date.now() - THREE_DAYS;
    const hits: ScanHit[] = [];
    const queue = [...top];
    const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          const candles = await loadOne(item.symbol, data.interval, limit);
          if (candles.length < 40) continue;
          const papers = papersFrom(item.symbol, data.interval, candles, analyze(candles, data.params, data.interval), data.params);
          const closed = papers.filter((row) => row.status !== "open" && row.entryTime >= cutoff);
          const pnls = closed.map((row) => pnlPct(row)).filter((value) => Number.isFinite(value));
          if (pnls.length === 0) continue;
          const sum = pnls.reduce((total, value) => total + value, 0);
          const win = Math.round((pnls.filter((value) => value > 0).length / pnls.length) * 100);
          hits.push({ symbol: item.symbol, trades: pnls.length, win, sum: Math.round(sum * 100) / 100, volume: item.volume });
        } catch {
          continue;
        }
      }
    });
    await Promise.all(workers);
    hits.sort((a, b) => b.sum - a.sum || b.win - a.win);
    return { scanned: top.length, interval: data.interval, hits: hits.slice(0, 15) };
  });
