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
import { fetchBoard, type Board } from "@/lib/market";
import { useDesk } from "@/lib/store";
import { PriceChart } from "@/components/price-chart";
import { Journal, SessionPanel, Settings, SignalDock } from "@/components/panels";

function signature(rows: { id: string; status: string; exit?: number; sl: number; tp: number; sessionNote?: string; whaleNote?: string }[]): string {
  return rows.map((row) => `${row.id}:${row.status}:${row.exit ?? ""}:${row.sl}:${row.tp}:${row.sessionNote ?? ""}:${row.whaleNote ?? ""}`).join("|");
}

function badgeLabel(headline: string): string {
  if (headline === "TẠM LONG" || headline === "TẠM SHORT") return "TẠM";
  return headline;
}

function applyBoard(prev: Board | null, incoming: Board, symbols: string[]): Board {
  const map = new Map(prev?.rows.map((row) => [row.symbol, row]) ?? []);
  for (const row of incoming.rows) map.set(row.symbol, row);
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
  const [pinned, setPinned] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

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
        const next = await fetchBoard({ data: { symbols: requested, interval: requestedInterval, limit: 500 } });
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
        const next = await fetchBoard({ data: { symbols: missing, interval: requestedInterval, limit: 500 } });
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
      if (row.candles.length > 0) map.set(row.symbol, analyze(row.candles, params));
    }
    return map;
  }, [board, params]);

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
  }, [board, analyses, interval, params]);

  const activeRow = board?.rows.find((row) => row.symbol === active) ?? null;
  const candles: Candle[] = activeRow?.candles ?? [];
  const analysis = analyses.get(active) ?? null;
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
            <p className="text-xs text-muted">UT · Phiên · Cá voi</p>
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
                placeholder="Thêm SOL, ETH…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-base text-fg"
              />
              <button type="submit" className="h-11 rounded-md bg-bull px-3 text-sm font-medium text-ink">
                Thêm
              </button>
            </form>
            {formError ? <p className="mt-2 text-sm text-bear">{formError}</p> : null}
            <ul className="mt-2 flex flex-col">
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
              <p className="text-xs text-muted">Tam giác đậm: đủ ba cổng. Vàng: thiếu cổng. Chấm: UT bị SMA loại. Dải ngang: hấp thụ.</p>
            </div>
            {analysis && candles.length > 0 ? (
              <PriceChart
                resetKey={`${active}|${interval}`}
                candles={candles}
                analysis={analysis}
                trade={openTrade}
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
            onChange={(patch) => useDesk.getState().setParams(patch)}
            onReset={() => useDesk.getState().resetParams()}
          />
        </aside>
      </div>
    </div>
  );
}
