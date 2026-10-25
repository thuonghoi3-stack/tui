import { createServerFn } from "@tanstack/react-start";
import { INTERVALS, type Candle, type Interval } from "@/lib/engine";

export type BoardRow = { symbol: string; candles: Candle[]; error: string | null };
export type Board = { rows: BoardRow[]; fetchedAt: number };

const cache = new Map<string, { at: number; candles: Candle[] }>();
const TTL_MS = 15_000;

async function loadOne(symbol: string, interval: Interval, limit: number): Promise<Candle[]> {
  const key = `${symbol}|${interval}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.candles;
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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
  cache.set(key, { at: Date.now(), candles });
  return candles;
}

function parseBoard(input: unknown): { symbols: string[]; interval: Interval; limit: number } {
  if (!input || typeof input !== "object") throw new Error("Thiếu dữ liệu");
  const raw = input as { symbols?: unknown; interval?: unknown; limit?: unknown };
  if (!Array.isArray(raw.symbols) || raw.symbols.length < 1 || raw.symbols.length > 8) {
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
      ? Math.min(500, Math.max(120, Math.floor(raw.limit)))
      : 500;
  return { symbols, interval: raw.interval as Interval, limit };
}

export const fetchBoard = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseBoard(input))
  .handler(async ({ data }) => {
    const rows: BoardRow[] = await Promise.all(
      data.symbols.map(async (symbol) => {
        try {
          const candles = await loadOne(symbol, data.interval, data.limit);
          if (candles.length === 0) return { symbol, candles, error: "Không có nến" };
          return { symbol, candles, error: null as string | null };
        } catch (err) {
          const error = err instanceof Error ? err.message : "Không tải được";
          return { symbol, candles: [] as Candle[], error };
        }
      }),
    );
    return { rows, fetchedAt: Date.now() } satisfies Board;
  });
