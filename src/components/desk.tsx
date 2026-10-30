import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  analyze,
  changePct,
  clampParams,
  defaultParams,
  focusOfMarker,
  INTERVAL_LABEL,
  INTERVALS,
  mergeJournal,
  papersFrom,
  type Analysis,
  type Candle,
  type FocusView,
} from "@/lib/engine";
import { formatClock, formatPct, formatPx, formatVn } from "@/lib/format";
import { fetchBoard, scanPairs, type Board, type ScanHit } from "@/lib/market";
import { useDesk } from "@/lib/store";
import { PriceChart } from "@/components/price-chart";
import { Journal, SessionPanel, Settings, SignalDock } from "@/components/panels";

function signature(rows: { id: string; status: string; exit?: number; sl: number; tp: number; sessionNote?: string; whaleNote?: string; wyckoffNote?: string }[]): string {
  return rows
    .map((row) => `${row.id}:${row.status}:${row.exit ?? ""}:${row.sl}:${row.tp}:${row.sessionNote ?? ""}:${row.whaleNote ?? ""}:${row.wyckoffNote ?? ""}`)
    .join("|");
}

function badgeLabel(headline: string): string {
  if (headline === "TẠM LONG" || headline === "TẠM SHORT") return "TẠM";
  return headline;
}

function mergeCandles(prev: Board["rows"][number]["candles"], next: Board["rows"][number]["candles"]) {
  const map = new Map<number, (typeof next)[number]>();
  for (const candle of prev) map.set(candle.time, candle);
  for (const candle of next) map.set(candle.time, candle);
  return [...map.values()].sort((a, b) => a.time - b.time).slice(-2000);
}

function applyBoard(prev: Board | null, incoming: Board, symbols: string[]): Board {
  const map = new Map(prev?.rows.map((row) => [row.symbol, row]) ?? []);
  for (const row of incoming.rows) {
    const old = map.get(row.symbol);
    if (row.candles.length === 0 && old) {
      map.set(row.symbol, { ...old, error: row.error });
      continue;
    }
    map.set(row.symbol, { ...row, candles: mergeCandles(old?.candles ?? [], row.candles) });
  }
  return {
    rows: symbols.flatMap((symbol) => {
      const row = map.get(symbol);
      return row ? [row] : [];
    }),
    fetchedAt: incoming.fetchedAt,
  };
}

export function Desk() {
  const symbols = useDesk((state) => state.symbols);
  const active = useDesk((state) => state.active);
  const interval = useDesk((state) => state.interval);
  const storedParams = useDesk((state) => state.params);
  const journal = useDesk((state) => state.journal);
  const hydrated = useDesk((state) => state.hydrated);
  const params = useMemo(() => clampParams({ ...defaultParams, ...storedParams }), [storedParams]);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [scanHits, setScanHits] = useState<ScanHit[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [statsRun, setStatsRun] = useState(0);

  useEffect(() => {
    let alive = true;
    void Promise.resolve(useDesk.persist.rehydrate()).finally(() => {
      if (alive) useDesk.setState({ hydrated: true });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!symbols.includes(active) && symbols[0]) useDesk.getState().setActive(symbols[0]);
  }, [hydrated, symbols, active]);

  useEffect(() => {
    setPinned(null);
  }, [active, interval]);

  const missingKey = symbols.filter((symbol) => !board?.rows.some((row) => row.symbol === symbol)).join("|");

  useEffect(() => {
    setBoard(null);
  }, [interval]);

  useEffect(() => {
    if (!hydrated) return;
    let cancel = false;
    const run = async (background: boolean) => {
      const requestedInterval = useDesk.getState().interval;
      const requested = useDesk.getState().symbols;
      if (!background) setLoading(true);
      try {
        const next = await fetchBoard({ data: { symbols: requested, interval: requestedInterval, limit: background ? 200 : 2000 } });
        if (cancel || useDesk.getState().interval !== requestedInterval) return;
        setBoard((prev) => applyBoard(prev, next, useDesk.getState().symbols));
        setError(null);
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "Không tải được dữ liệu");
      } finally {
        if (!cancel && !background) setLoading(false);
      }
    };
    void run(false);
    const timer = setInterval(() => void run(true), 25_000);
    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [hydrated, interval, tick]);

  useEffect(() => {
    if (!hydrated || !board || !missingKey) return;
    let cancel = false;
    const requestedInterval = interval;
    const missing = missingKey.split("|");
    void (async () => {
      try {
        const next = await fetchBoard({ data: { symbols: missing, interval: requestedInterval, limit: 2000 } });
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
  }, [hydrated, missingKey, interval]);

  const analyses = useMemo(() => {
    const map = new Map<string, Analysis>();
    if (!board) return map;
    for (const row of board.rows) {
      if (row.candles.length > 0) map.set(row.symbol, analyze(row.candles, params, interval));
    }
    return map;
  }, [board, params, interval, statsRun]);

  useEffect(() => {
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
  }, [board, analyses, interval, params, statsRun]);

  const activeRow = board?.rows.find((row) => row.symbol === active) ?? null;
  const candles: Candle[] = activeRow?.candles ?? [];
  const analysis = analyses.get(active) ?? null;
  const exits = useMemo(() => {
    if (!analysis || candles.length === 0) return [];
    return papersFrom(active, interval, candles, analysis, params).filter((row) => row.status !== "open" && row.exit && row.exitTime);
  }, [analysis, candles, active, interval, params]);
  const pinnedMarker = analysis?.markers.find((marker) => marker.index === pinned) ?? null;
  const focus: FocusView | null = pinnedMarker ? focusOfMarker(pinnedMarker, candles, params) : (analysis?.live ?? null);
  const safeJournal = Array.isArray(journal) ? journal : [];
  const openTrade =
    safeJournal.find((row) => row.symbol === active && row.interval === interval && row.status === "open") ?? null;
  const delta = candles.length ? changePct(candles, interval) : Number.NaN;
  const marks: Record<string, number> = {};
  for (const row of board?.rows ?? []) {
    const last = row.candles[row.candles.length - 1];
    if (last) marks[`${row.symbol}|${interval}`] = last.close;
  }
  const clock = now ? formatClock(now) : null;

  return (
    <div className="desk">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
            <rect x="2" y="14" width="6" height="16" rx="1" fill="var(--color-line)" />
            <rect x="13" y="4" width="6" height="26" rx="1" fill="var(--color-bull)" />
            <rect x="24" y="10" width="6" height="20" rx="1" fill="var(--color-bear)" />
          </svg>
          <div>
            <p className="text-lg font-semibold tracking-tight text-fg">ORCA</p>
            <p className="text-xs text-muted">UT · Wyckoff · Phiên · Cá voi</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Khung thời gian">
          {INTERVALS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === interval}
              className={`h-11 rounded-md px-3 font-mono text-sm ${item === interval ? "bg-bull text-ink" : "bg-surface text-muted"}`}
              onClick={() => useDesk.getState().setInterval(item)}
            >
              {INTERVAL_LABEL[item]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right font-mono text-xs text-muted">
            <p>VN {clock ? clock.vn : "—"}</p>
            <p>UTC {clock ? clock.utc : "—"}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-fg"
            onClick={() => setTick((value) => value + 1)}
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Làm mới
          </button>
        </div>
      </header>

      <div className="desk-body">
        <aside className="rail flex flex-col gap-3">
          <section className="rounded-md border border-border bg-surface p-3">
            <h2 className="text-sm font-semibold text-fg">Cặp theo dõi</h2>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const message = useDesk.getState().addSymbol(draft);
                setFormError(message);
                if (!message) setDraft("");
              }}
            >
              <input
                aria-label="Thêm cặp"
                placeholder="Thêm cặp, tối đa 40"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-base text-fg"
              />
              <button type="submit" className="h-11 rounded-md bg-bull px-3 text-sm font-medium text-ink">
                Thêm
              </button>
            </form>
            {formError ? <p className="mt-2 text-sm text-bear">{formError}</p> : null}
            <ul className="mt-2 flex max-h-[46vh] flex-col overflow-auto">
              {symbols.map((symbol) => {
                const row = board?.rows.find((item) => item.symbol === symbol);
                const view = analyses.get(symbol);
                const price = row?.candles[row.candles.length - 1]?.close;
                const change = row && row.candles.length ? changePct(row.candles, interval) : Number.NaN;
                const headline = view?.live.headline ?? (row?.error ? "LỖI" : "…");
                const tone = view?.live.tone ?? "muted";
                const selected = symbol === active;
                return (
                  <li key={symbol} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => useDesk.getState().setActive(symbol)}
                      className={`flex min-h-14 flex-1 items-center justify-between gap-2 border-l-2 py-2 pl-2 text-left ${
                        selected ? "border-bull bg-surface-2" : "border-transparent"
                      }`}
                    >
                      <span>
                        <span className="block font-mono text-sm text-fg">{symbol}</span>
                        <span className="font-mono text-xs text-muted">
                          {price ? formatPx(price) : row ? "—" : "…"}{" "}
                          <span className={change > 0 ? "text-bull" : change < 0 ? "text-bear" : ""}>{formatPct(change)}</span>
                        </span>
                      </span>
                      <span className={`font-mono text-xs ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : tone === "wait" ? "text-line" : "text-muted"}`}>
                        {badgeLabel(headline)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Xóa ${symbol}`}
                      className="h-14 w-11 text-sm text-muted"
                      onClick={() => useDesk.getState().removeSymbol(symbol)}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted">
              {board ? `Cập nhật ${formatVn(board.fetchedAt)} VN` : hydrated ? "Đang kéo nến Binance…" : "Đang mở bàn…"}
              {error ? ` · ${error}` : ""}
            </p>
          </section>
          <section className="rounded-md border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-fg">Quét 3 ngày</h2>
              <button
                type="button"
                className="h-11 rounded-md bg-bull px-3 text-sm font-medium text-ink disabled:opacity-60"
                disabled={scanning}
                onClick={() => {
                  setScanning(true);
                  setScanError(null);
                  void scanPairs({ data: { interval, params } })
                    .then((result) => setScanHits(result.hits))
                    .catch((err: unknown) => setScanError(err instanceof Error ? err.message : "Không quét được"))
                    .finally(() => setScanning(false));
                }}
              >
                {scanning ? "Đang quét…" : "Quét top 100"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">Top khối lượng 24 giờ trên Binance. Xếp theo tỷ lệ thắng nhân tổng lãi trong 3 ngày. Cặp lỗ xếp cuối.</p>
            {scanError ? <p className="mt-2 text-sm text-bear">{scanError}</p> : null}
            {scanHits ? (
              <ul className="mt-2 flex max-h-64 flex-col overflow-auto">
                {scanHits.length === 0 ? <li className="py-2 text-sm text-muted">Không có lệnh đóng trong 3 ngày.</li> : null}
                {scanHits.map((hit) => {
                  const onBoard = symbols.includes(hit.symbol);
                  return (
                    <li key={hit.symbol} className="flex items-center justify-between gap-2 border-t border-border py-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          if (symbols.includes(hit.symbol)) useDesk.getState().setActive(hit.symbol);
                        }}
                      >
                        <span className="font-mono text-sm text-fg">{hit.symbol.replace("USDT", "")}</span>
                        <span className="mt-0.5 block font-mono text-xs text-muted">
                          {hit.trades} lệnh · thắng {hit.win}% · {formatPct(hit.sum)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="h-11 shrink-0 rounded-md border border-border px-3 text-sm text-fg disabled:text-muted"
                        disabled={onBoard}
                        onClick={() => {
                          const message = useDesk.getState().addSymbol(hit.symbol);
                          setFormError(message);
                        }}
                      >
                        {onBoard ? "Đã có" : "Thêm"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
          <SessionPanel analysis={analysis} nowMs={now} />
          <p className="px-1 text-xs text-muted">Mô phỏng trên nến Binance. Không đặt lệnh thật.</p>
        </aside>

        <section className="stage">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2">
              <h2 className="font-mono text-base text-fg">{active}</h2>
              <p className="font-mono text-sm text-fg">
                {candles.length ? formatPx(candles[candles.length - 1].close) : "—"}
                <span className={`ml-2 ${delta > 0 ? "text-bull" : delta < 0 ? "text-bear" : "text-muted"}`}>
                  {formatPct(delta)}
                </span>
              </p>
              <p className="text-xs text-muted">Tam giác: vào lệnh. Ô TP, SL, Đảo: thoát. Vàng: thiếu cổng. Chấm: UT bị SMA loại.</p>
            </div>
            {analysis && candles.length > 0 ? (
              <PriceChart
                resetKey={`${active}|${interval}`}
                candles={candles}
                analysis={analysis}
                trade={openTrade}
                exits={exits}
                pinned={pinned}
                onPin={setPinned}
              />
            ) : (
              <div className="chart-surface flex items-center justify-center bg-bg px-6 text-center">
                <p className="max-w-sm text-sm text-muted">
                  {activeRow?.error
                    ? activeRow.error
                    : !activeRow || loading || !hydrated
                      ? "Đang kéo nến và dựng stop UT, dải SMA, phiên và profile cá voi."
                      : "Chưa có nến cho cặp này."}
                </p>
              </div>
            )}
          </div>
          <Journal
            rows={safeJournal}
            marks={marks}
            onOpen={(symbol) => useDesk.getState().setActive(symbol)}
            onClear={() => useDesk.getState().clearJournal()}
          />
        </section>

        <aside className="dock flex flex-col gap-3">
          {focus && analysis ? (
            <SignalDock
              focus={focus}
              analysis={analysis}
              pinned={pinnedMarker != null}
              onClearPin={() => setPinned(null)}
              intervalWarning={interval === "4h"}
            />
          ) : (
            <section className="rounded-md border border-border bg-surface px-3 py-4">
              <p className="text-sm text-muted">
                {loading ? "Đang tính tín hiệu…" : "Chọn một cặp có nến để xem UT, phiên và cá voi."}
              </p>
            </section>
          )}
          <Settings
            params={params}
            onApply={(next) => {
              useDesk.getState().setParams(next);
              setStatsRun((run) => run + 1);
            }}
          />
        </aside>
      </div>
    </div>
  );
}
