import { useEffect, useRef, useState } from "react";
import type { Analysis, Candle, Paper } from "@/lib/engine";
import { formatPx, formatVn } from "@/lib/format";

type Props = {
  resetKey: string;
  candles: Candle[];
  analysis: Analysis;
  trade: Paper | null;
  pinned: number | null;
  onPin: (index: number | null) => void;
};

type Drag = { x: number; y: number; end: number; active: boolean };

export function PriceChart({ resetKey, candles, analysis, trade, pinned, onPin }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [count, setCount] = useState(130);
  const [end, setEnd] = useState(-1);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setCount(130);
    setEnd(-1);
    setHover(null);
  }, [resetKey]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(0, Math.floor(rect.width)), h: Math.max(0, Math.floor(rect.height)) });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setCount((value) => {
        const next = Math.round(value * (event.deltaY > 0 ? 1.14 : 0.88));
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
    for (const series of [analysis.stops, analysis.sma, analysis.upper, analysis.lower]) {
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
  const pad = (maxP - minP) * 0.08 || 1;
  minP -= pad;
  maxP += pad;

  const plotL = 10;
  const plotT = 22;
  const plotB = Math.max(plotT + 20, size.h - 28);
  const profileW = Math.min(108, Math.max(64, size.w * 0.18));
  const axisW = 72;
  const plotR = Math.max(plotL + 20, size.w - 8 - profileW - axisW);
  const plotH = Math.max(1, plotB - plotT);
  const plotW = Math.max(1, plotR - plotL);
  const visible = Math.max(1, endIndex - startIndex + 1);
  const slot = plotW / visible;
  const yOf = (price: number) => plotT + ((maxP - price) / (maxP - minP)) * plotH;
  const xOf = (index: number) => plotL + slot * (index - startIndex) + slot / 2;

  const indexAt = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    if (x < plotL || x > plotR) return null;
    const index = startIndex + Math.floor((x - plotL) / slot);
    if (index < startIndex || index > endIndex) return null;
    return index;
  };

  const pathOf = (series: number[]) => {
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
  const gridPrices = [0, 1, 2, 3].map((step) => maxP - ((maxP - minP) * step) / 3);
  const labelEvery = Math.max(1, Math.round(72 / Math.max(slot, 1)));

  return (
    <div
      ref={boxRef}
      className={dragging ? "chart-surface relative is-drag" : "chart-surface relative"}
      onDoubleClick={() => {
        setCount(130);
        setEnd(-1);
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        dragRef.current = { x: event.clientX, y: event.clientY, end: endIndex, active: false };
      }}
      onPointerMove={(event) => {
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
      }}
      onPointerUp={(event) => {
        const current = dragRef.current;
        dragRef.current = null;
        setDragging(false);
        if (current?.active) return;
        const index = indexAt(event.clientX);
        if (index == null) return;
        const marker = analysis.markers.find((item) => item.index === index);
        onPin(marker ? (pinned === marker.index ? null : marker.index) : null);
      }}
      onPointerLeave={() => {
        if (!dragRef.current?.active) setHover(null);
        dragRef.current = null;
        setDragging(false);
      }}
    >
      {hoverCandle ? (
        <div className="pointer-events-none absolute left-3 top-2 z-10 font-mono text-xs text-muted">
          {formatVn(hoverCandle.time, true)} · O {formatPx(hoverCandle.open)} · H {formatPx(hoverCandle.high)} · L{" "}
          {formatPx(hoverCandle.low)} · C {formatPx(hoverCandle.close)}
        </div>
      ) : null}
      <div
        className="absolute bottom-9 left-3 z-10 flex gap-1"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <button type="button" className="h-11 w-11 rounded-md border border-border bg-surface text-fg" onClick={() => setCount((value) => Math.max(40, Math.round(value * 0.8)))} aria-label="Phóng to">
          +
        </button>
        <button type="button" className="h-11 w-11 rounded-md border border-border bg-surface text-fg" onClick={() => setCount((value) => Math.min(candles.length, Math.round(value * 1.25)))} aria-label="Thu nhỏ">
          −
        </button>
        <button type="button" className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-fg" onClick={() => setEnd(-1)}>
          Mới nhất
        </button>
      </div>
      {size.w > 40 && size.h > 40 ? (
        <svg width={size.w} height={size.h} className="absolute inset-0" role="img" aria-label="Biểu đồ nến, UT, SMA và profile cá voi">
          {gridPrices.map((price) => (
            <g key={price}>
              <line x1={plotL} x2={plotR} y1={yOf(price)} y2={yOf(price)} stroke="var(--color-border)" strokeDasharray="3 4" />
              <text x={plotR + 8} y={yOf(price) + 4} fill="var(--color-muted)" fontSize="11" fontFamily="IBM Plex Mono, ui-monospace, monospace">
                {formatPx(price)}
              </text>
            </g>
          ))}
          {analysis.whale.bins.map((bin, index) => {
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
              { width: bin.strongBuy * scale, color: "var(--color-bull)", opacity: 0.95 },
              { width: weakBuy * scale, color: "var(--color-bull)", opacity: 0.38 },
              { width: weakSell * scale, color: "var(--color-bear)", opacity: 0.38 },
              { width: bin.strongSell * scale, color: "var(--color-bear)", opacity: 0.95 },
            ];
            let cursor = profileR;
            return (
              <g key={`bin-${index}`}>
                {bin.peak ? (
                  <rect x={plotL} y={top} width={plotW} height={height} fill={support ? "var(--color-bull)" : "var(--color-bear)"} opacity={0.14} />
                ) : null}
                {parts.map((part, partIndex) => {
                  if (part.width < 0.5) return null;
                  cursor -= part.width;
                  return <rect key={partIndex} x={cursor} y={top} width={Math.max(1, part.width)} height={height} fill={part.color} opacity={part.opacity} />;
                })}
              </g>
            );
          })}
          <path d={pathOf(analysis.lower)} fill="none" stroke="var(--color-bull)" strokeOpacity={0.45} strokeDasharray="4 4" />
          <path d={pathOf(analysis.upper)} fill="none" stroke="var(--color-bear)" strokeOpacity={0.45} strokeDasharray="4 4" />
          <path d={pathOf(analysis.sma)} fill="none" stroke="var(--color-line)" strokeWidth={1.4} />
          {Array.from({ length: visible - 1 }, (_, offset) => {
            const index = startIndex + offset + 1;
            const prev = analysis.stops[index - 1];
            const next = analysis.stops[index];
            if (!Number.isFinite(prev) || !Number.isFinite(next)) return null;
            const up = candles[index].close >= next;
            return (
              <line
                key={`stop-${index}`}
                x1={xOf(index - 1)}
                y1={yOf(prev)}
                x2={xOf(index)}
                y2={yOf(next)}
                stroke={up ? "var(--color-bull)" : "var(--color-bear)"}
                strokeWidth={1.6}
              />
            );
          })}
          {trade ? (
            <g>
              <line x1={plotL} x2={plotR} y1={yOf(trade.sl)} y2={yOf(trade.sl)} stroke="var(--color-bear)" strokeDasharray="2 3" />
              <line x1={plotL} x2={plotR} y1={yOf(trade.tp)} y2={yOf(trade.tp)} stroke="var(--color-bull)" strokeDasharray="2 3" />
              <text x={plotL + 4} y={yOf(trade.sl) - 4} fill="var(--color-bear)" fontSize="11" fontFamily="IBM Plex Mono, ui-monospace, monospace">SL</text>
              <text x={plotL + 4} y={yOf(trade.tp) - 4} fill="var(--color-bull)" fontSize="11" fontFamily="IBM Plex Mono, ui-monospace, monospace">TP</text>
            </g>
          ) : null}
          {candles.slice(startIndex, endIndex + 1).map((candle, offset) => {
            const index = startIndex + offset;
            const up = candle.close >= candle.open;
            const color = up ? "var(--color-bull)" : "var(--color-bear)";
            const x = xOf(index);
            const bodyW = Math.max(1, Math.min(14, slot * 0.64));
            const top = Math.min(yOf(candle.open), yOf(candle.close));
            const height = Math.max(1, Math.abs(yOf(candle.close) - yOf(candle.open)));
            return (
              <g key={candle.time}>
                <line x1={x} x2={x} y1={yOf(candle.high)} y2={yOf(candle.low)} stroke={color} strokeWidth={1} />
                <rect x={x - bodyW / 2} y={top} width={bodyW} height={height} fill={color} />
              </g>
            );
          })}
          {markersHere.map((marker) => {
            const candle = candles[marker.index];
            const x = xOf(marker.index);
            const long = marker.side === "LONG";
            const y = long ? yOf(candle.low) + 14 : yOf(candle.high) - 14;
            const color = marker.tier === "filtered" ? "var(--color-muted)" : marker.tier === "partial" ? "var(--color-line)" : long ? "var(--color-bull)" : "var(--color-bear)";
            const tip = long
              ? `${x - 5},${y + 6} ${x + 5},${y + 6} ${x},${y - 4}`
              : `${x - 5},${y - 6} ${x + 5},${y - 6} ${x},${y + 4}`;
            const selected = pinned === marker.index;
            return (
              <g key={`${marker.index}-${marker.side}`}>
                {selected ? <circle cx={x} cy={y} r={11} fill="none" stroke="var(--color-fg)" /> : null}
                {marker.tier === "filtered" ? (
                  <circle cx={x} cy={long ? yOf(candle.low) + 8 : yOf(candle.high) - 8} r={2.5} fill={color} />
                ) : (
                  <polygon points={tip} fill={color} opacity={marker.provisional ? 0.55 : 1} />
                )}
                {marker.tier === "confirmed" ? (
                  <text
                    x={x}
                    y={long ? y + 18 : y - 12}
                    textAnchor="middle"
                    fill={color}
                    fontSize="10"
                    fontFamily="IBM Plex Mono, ui-monospace, monospace"
                  >
                    {marker.provisional ? "TẠM" : marker.side}
                  </text>
                ) : null}
              </g>
            );
          })}
          {hover != null && hover >= startIndex && hover <= endIndex ? (
            <line x1={xOf(hover)} x2={xOf(hover)} y1={plotT} y2={plotB} stroke="var(--color-muted)" strokeDasharray="2 3" />
          ) : null}
          <line x1={plotR + axisW} x2={plotR + axisW} y1={plotT} y2={plotB} stroke="var(--color-border)" />
          <text x={plotR + axisW + 4} y={plotT + 12} fill="var(--color-muted)" fontSize="10" fontFamily="IBM Plex Mono, ui-monospace, monospace">
            Cá voi
          </text>
          {Array.from({ length: visible }, (_, offset) => startIndex + offset)
            .filter((index) => (index - startIndex) % labelEvery === 0)
            .map((index) => (
              <text key={`t-${index}`} x={xOf(index)} y={size.h - 8} textAnchor="middle" fill="var(--color-muted)" fontSize="10" fontFamily="IBM Plex Mono, ui-monospace, monospace">
                {formatVn(candles[index].time, visible < 80)}
              </text>
            ))}
        </svg>
      ) : null}
    </div>
  );
}
