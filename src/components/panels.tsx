import { useState } from "react";
import {
  hourOf,
  pnlPct,
  SESSIONS,
  type Analysis,
  type Check,
  type FocusView,
  type HourStat,
  type Paper,
  type Params,
} from "@/lib/engine";
import { formatPct, formatPx, formatVn, formatVol } from "@/lib/format";

function toneClass(tone: FocusView["tone"]): string {
  if (tone === "bull") return "text-bull";
  if (tone === "bear") return "text-bear";
  if (tone === "wait") return "text-line";
  return "text-muted";
}

function stateMark(state: Check["state"]): string {
  if (state === "pass") return "bg-bull";
  if (state === "fail") return "bg-bear";
  return "bg-line";
}

export function SignalDock({
  focus,
  analysis,
  pinned,
  onClearPin,
  intervalWarning,
}: {
  focus: FocusView;
  analysis: Analysis;
  pinned: boolean;
  onClearPin: () => void;
  intervalWarning: boolean;
}) {
  const whale = analysis.whale;
  return (
    <section className="rounded-md border border-border bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-3">
        <div>
          <p className="text-sm text-muted">{focus.kicker}</p>
          <p className={`font-mono text-3xl font-semibold tracking-tight ${toneClass(focus.tone)}`}>{focus.headline}</p>
          <p className="mt-1 text-sm text-fg">{focus.sub}</p>
          {focus.time ? <p className="mt-1 font-mono text-xs text-muted">{formatVn(focus.time, true)} VN</p> : null}
        </div>
        {pinned ? (
          <button type="button" className="h-11 shrink-0 rounded-md border border-border px-3 text-sm text-fg" onClick={onClearPin}>
            Về hiện tại
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2 px-3 py-3">
        {focus.checks.map((check) => (
          <li key={check.label} className="flex gap-2">
            <span className={`mt-1 size-2.5 shrink-0 rounded-full ${stateMark(check.state)}`} />
            <div>
              <p className="text-sm text-fg">{check.label}</p>
              <p className="text-sm text-muted">{check.text}</p>
            </div>
          </li>
        ))}
      </ul>
      {focus.entry != null ? (
        <div className="grid grid-cols-3 gap-2 border-t border-border px-3 py-3 font-mono text-sm">
          <Level label="Vào" value={formatPx(focus.entry)} />
          <Level label="SL" value={formatPx(focus.sl ?? Number.NaN)} className="text-bear" />
          <Level label="TP" value={formatPx(focus.tp ?? Number.NaN)} className="text-bull" />
          {focus.planNote ? <p className="col-span-3 font-sans text-xs text-muted">{focus.planNote}</p> : null}
        </div>
      ) : null}
      <div className="border-t border-border px-3 py-3">
        <p className="text-sm text-muted">Profile cá voi hiện tại</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">
          <Stat k="Delta quanh giá" v={formatVol(whale.deltaNear)} />
          <Stat k="Delta cửa sổ" v={formatVol(whale.profileDelta)} />
          <Stat k="Đỡ gần" v={whale.support ? formatPx(whale.support.mid) : "—"} />
          <Stat k="Cản gần" v={whale.resistance ? formatPx(whale.resistance.mid) : "—"} />
        </dl>
      </div>
      <p className="border-t border-border px-3 py-3 text-sm text-muted">
        Cửa sổ này: {analysis.counts.confirmedLong} LONG · {analysis.counts.confirmedShort} SHORT đã vào sổ ·{" "}
        {analysis.counts.partial} chờ cổng · {analysis.counts.filtered} bị SMA loại.
        {analysis.lastConfirmed
          ? ` Lần ghi sổ gần nhất ${analysis.lastConfirmed.side} lúc ${formatVn(analysis.lastConfirmed.time, true)}.`
          : ""}
      </p>
      {intervalWarning ? (
        <p className="px-3 pb-3 text-sm text-line">Khung 4 giờ làm thống kê theo giờ rất thưa. Nên xem 15 phút hoặc 1 giờ.</p>
      ) : null}
      <p className="px-3 pb-3 text-xs text-muted">
        UT và bộ lọc SMA theo strategy. Phiên và cá voi chỉ loại lệnh khi thuận chiều quá rõ, vì đây là lệnh đảo chứ không phải lệnh đuổi. Sổ lệnh là giấy, không phải lệnh thật và không phải lời khuyên đầu tư.
      </p>
    </section>
  );
}

function Level({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="font-sans text-xs text-muted">{label}</p>
      <p className={className ?? "text-fg"}>{value}</p>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-sans text-xs text-muted">{k}</dt>
      <dd className="text-fg">{v}</dd>
    </div>
  );
}

export function SessionPanel({ analysis, nowMs }: { analysis: Analysis | null; nowMs: number | null }) {
  const hours = analysis?.hours ?? [];
  const candleHour = analysis?.live.time != null ? hourOf(analysis.live.time) : nowMs != null ? hourOf(nowMs) : null;
  const ranked = [...(analysis?.sessions ?? [])].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const qualified = hours.filter((hour) => hour.qualified && Number.isFinite(hour.score));
  const best = [...qualified].sort((a, b) => b.score - a.score)[0];
  const avoid = [...hours].filter((hour) => hour.qualified).sort((a, b) => a.range - b.range)[0];

  return (
    <section className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">Phiên</h2>
        <p className="font-mono text-xs text-muted">UTC</p>
      </div>
      {analysis ? (
        <p className="mt-1 text-sm text-muted">
          Nến này: {analysis.sessionsNow.length ? analysis.sessionsNow.join(" · ") : "ngoài phiên"}
          {analysis.overlap ? " · giao London × New York" : ""}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Đang chờ nến để xếp phiên.</p>
      )}
      <h3 className="mt-3 text-sm font-semibold text-fg">Giờ trong ngày</h3>
      <p className="mt-1 text-xs text-muted">
        {best ? `Tập trung ${String(best.hour).padStart(2, "0")}:00` : "Chưa đủ mẫu"}
        {avoid ? ` · tránh ${String(avoid.hour).padStart(2, "0")}:00` : ""}
      </p>
      <div className="mt-2 grid grid-cols-8 gap-1">
        {hours.map((hour) => (
          <HourCell key={hour.hour} hour={hour} active={hour.hour === candleHour} />
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {ranked.map((session) => {
          const active = analysis?.sessionsNow.includes(session.name);
          const window = SESSIONS.find((item) => item.id === session.id);
          const label = window ? `${String(window.start).padStart(2, "0")}:00–${String(window.end).padStart(2, "0")}:00` : "";
          return (
            <div key={session.id} className={`rounded-sm border px-2 py-1.5 ${active ? "border-bull bg-surface-2" : "border-border"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm text-fg">
                  {session.name}
                  {active ? <span className="text-bull"> · mở</span> : null}
                </p>
                <p className="font-mono text-xs text-muted">{session.rank ? `#${session.rank}` : "—"}</p>
              </div>
              <p className="font-mono text-xs text-muted">
                {label} · biên {Number.isFinite(session.range) ? `${session.range.toFixed(2)}%` : "—"} · bull{" "}
                {Number.isFinite(session.bull) ? `${session.bull.toFixed(0)}%` : "—"} · drift {formatPct(session.drift, 3)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HourCell({ hour, active }: { hour: HourStat; active: boolean }) {
  const up = Number.isFinite(hour.bull) && hour.bull >= 50;
  const strength = Number.isFinite(hour.bull) ? Math.min(1, Math.abs(hour.bull - 50) / 25) : 0;
  const title = hour.qualified
    ? `${String(hour.hour).padStart(2, "0")}:00 UTC · bull ${hour.bull.toFixed(0)}% · drift ${hour.drift.toFixed(3)}% · biên ${hour.range.toFixed(3)}% · hạng biên ${hour.rangeRank}`
    : `${String(hour.hour).padStart(2, "0")}:00 UTC · ${hour.bars} nến`;
  return (
    <div className="relative h-8 overflow-hidden rounded-sm bg-surface-2" title={title}>
      {hour.qualified ? (
        <div className={`absolute inset-0 ${up ? "bg-bull" : "bg-bear"}`} style={{ opacity: 0.2 + strength * 0.65 }} />
      ) : null}
      <span className="relative flex h-full items-center justify-center font-mono text-xs text-fg">
        {String(hour.hour).padStart(2, "0")}
      </span>
      {active ? <span className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-fg" /> : null}
    </div>
  );
}

export function Journal({
  rows,
  marks,
  onOpen,
  onClear,
}: {
  rows: Paper[];
  marks: Record<string, number>;
  onOpen: (symbol: string) => void;
  onClear: () => void;
}) {
  const closed = rows.filter((row) => row.status !== "open");
  const wins = closed.filter((row) => row.status === "tp").length;
  const winRate = closed.length ? (wins / closed.length) * 100 : Number.NaN;
  const sum = closed.reduce((total, row) => total + (pnlPct(row) || 0), 0);
  return (
    <section className="rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">Sổ giấy</h2>
          <p className="font-mono text-xs text-muted">
            Chỉ lệnh qua các cổng đang bật · đóng {closed.length} · thắng{" "}
            {Number.isFinite(winRate) ? `${winRate.toFixed(0)}%` : "—"} · tổng {formatPct(closed.length ? sum : Number.NaN)} chưa phí
          </p>
        </div>
        <button type="button" className="h-11 rounded-md border border-border px-3 text-sm text-muted" onClick={onClear}>
          Xóa sổ
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted">
          Chưa có lệnh. Sổ chỉ ghi sau nến đóng, khi các cổng đang bật không thấy phiên hoặc cá voi thuận chiều quá rõ.
        </p>
      ) : (
        <>
          <ul className="max-h-64 divide-y divide-border overflow-auto xl:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left" onClick={() => onOpen(row.symbol)}>
                  <span>
                    <span className={`font-mono text-sm ${row.side === "LONG" ? "text-bull" : "text-bear"}`}>
                      {row.side} {row.symbol}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-muted">
                      {formatVn(row.signalTime, true)} · vào {formatPx(row.entry)}
                    </span>
                    <GateNotes row={row} />
                  </span>
                  <TradeResult row={row} mark={marks[`${row.symbol}|${row.interval}`]} />
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden max-h-40 overflow-auto xl:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Thời gian</th>
                  <th className="px-2 py-2 font-medium">Cặp</th>
                  <th className="px-2 py-2 font-medium">Lệnh</th>
                  <th className="px-2 py-2 font-medium">Vào</th>
                  <th className="px-2 py-2 font-medium">SL</th>
                  <th className="px-2 py-2 font-medium">TP</th>
                  <th className="px-2 py-2 font-medium">Kết</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs text-muted">
                      {formatVn(row.signalTime, true)}
                      <GateNotes row={row} />
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" className="font-mono text-fg" onClick={() => onOpen(row.symbol)}>
                        {row.symbol}
                      </button>
                    </td>
                    <td className={`px-2 py-2 font-mono ${row.side === "LONG" ? "text-bull" : "text-bear"}`}>{row.side}</td>
                    <td className="px-2 py-2 font-mono">{formatPx(row.entry)}</td>
                    <td className="px-2 py-2 font-mono text-bear">{formatPx(row.sl)}</td>
                    <td className="px-2 py-2 font-mono text-bull">{formatPx(row.tp)}</td>
                    <td className="px-2 py-2">
                      <TradeResult row={row} mark={marks[`${row.symbol}|${row.interval}`]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function GateNotes({ row }: { row: Paper }) {
  if (!row.sessionNote && !row.whaleNote) return null;
  return (
    <span className="mt-0.5 block font-mono text-xs leading-snug text-muted">
      {row.sessionNote ? <span className="block">Phiên đạt · {row.sessionNote}</span> : null}
      {row.whaleNote ? <span className="block">Cá voi đạt · {row.whaleNote}</span> : null}
    </span>
  );
}

function TradeResult({ row, mark }: { row: Paper; mark?: number }) {
  const value = pnlPct(row, mark);
  const label = row.status === "tp" ? "TP" : row.status === "sl" ? "SL" : "Mở";
  const color = !Number.isFinite(value) ? "text-muted" : value >= 0 ? "text-bull" : "text-bear";
  return (
    <span className={`font-mono text-sm ${color}`}>
      {label} {formatPct(value)}
    </span>
  );
}

export function Settings({
  params,
  onChange,
  onReset,
}: {
  params: Params;
  onChange: (patch: Partial<Params>) => void;
  onReset: () => void;
}) {
  return (
    <details className="group rounded-md border border-border bg-surface">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-3 text-sm text-fg">
        Thông số UT, SMA, phiên, cá voi
        <span className="text-muted group-open:hidden">Mở</span>
        <span className="hidden text-muted group-open:inline">Đóng</span>
      </summary>
      <div className="grid grid-cols-2 gap-3 px-3 pb-3">
        <Num label="UT key" value={params.utKey} step={0.1} onChange={(utKey) => onChange({ utKey })} />
        <Num label="ATR" value={params.atrPeriod} onChange={(atrPeriod) => onChange({ atrPeriod })} />
        <Num label="SMA" value={params.smaLen} onChange={(smaLen) => onChange({ smaLen })} />
        <Num label="Cách SMA %" value={params.smaDist} step={0.01} onChange={(smaDist) => onChange({ smaDist })} />
        <Num label="Nhìn lại N nến" value={params.smaLook} onChange={(smaLook) => onChange({ smaLook })} />
        <Num label="SL %" value={params.slPct} step={0.1} onChange={(slPct) => onChange({ slPct })} />
        <Num label="TP %" value={params.tpPct} step={0.1} onChange={(tpPct) => onChange({ tpPct })} />
        <Num label="Cá voi lookback" value={params.whaleLookback} onChange={(whaleLookback) => onChange({ whaleLookback })} />
        <Num label="Số bin" value={params.whaleBins} onChange={(whaleBins) => onChange({ whaleBins })} />
        <Num label="Ngưỡng mạnh %" value={params.strengthPct} onChange={(strengthPct) => onChange({ strengthPct })} />
        <Num label="Tối thiểu nến / giờ" value={params.sessionMinBars} onChange={(sessionMinBars) => onChange({ sessionMinBars })} />
        <Num label="Bull tối thiểu LONG" value={params.bullMin} step={1} onChange={(bullMin) => onChange({ bullMin })} />
        <Num label="Bull tối đa SHORT" value={params.bearMax} onChange={(bearMax) => onChange({ bearMax })} />
        <Toggle label="Bắt buộc cách SMA" on={params.requireSma} onClick={() => onChange({ requireSma: !params.requireSma })} />
        <Toggle label="Đo bằng high/low" on={params.useExtreme} onClick={() => onChange({ useExtreme: !params.useExtreme })} />
        <Toggle label="Bắt buộc phiên" on={params.requireSession} onClick={() => onChange({ requireSession: !params.requireSession })} />
        <Toggle label="Bắt buộc cá voi" on={params.requireWhale} onClick={() => onChange({ requireWhale: !params.requireWhale })} />
        <button type="button" className="col-span-2 h-11 rounded-md border border-border text-sm text-muted" onClick={onReset}>
          Đưa thông số về mặc định strategy
        </button>
        <p className="col-span-2 text-xs text-muted">
          Sổ giấy vào lệnh khi nến đã đóng và mọi cổng đang bật không đuổi theo. Phiên chỉ chặn khi khung đang mở thuận chiều rõ. Cá voi chỉ chặn khi delta quanh giá cùng chiều từ 35%. Tắt công tắc thì cổng đó không chặn sổ.
        </p>
      </div>
    </details>
  );
}

function Num({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  const decimal = step < 1;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : "");
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <input
        className="h-11 rounded-md border border-border bg-bg px-2 font-mono text-base text-fg"
        inputMode={decimal ? "decimal" : "numeric"}
        type="text"
        autoComplete="off"
        value={shown}
        onChange={(event) => {
          const raw = event.target.value;
          const body = raw.replace(",", ".");
          const ok = decimal ? /^\d*\.?\d*$/.test(body) : /^\d*$/.test(body);
          if (raw !== "" && !ok) return;
          setDraft(raw);
          if (body === "" || body === "." || body.endsWith(".")) return;
          const next = Number(body);
          if (Number.isFinite(next)) onChange(next);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="col-span-2 flex h-11 items-center justify-between rounded-md border border-border bg-bg px-3 text-sm text-fg"
    >
      {label}
      <span className={`rounded-sm px-2 py-1 font-mono text-xs ${on ? "bg-bull text-ink" : "bg-surface-2 text-muted"}`}>
        {on ? "Bật" : "Tắt"}
      </span>
    </button>
  );
}
