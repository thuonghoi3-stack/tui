type Side = "LONG" | "SHORT";
type Interval = "5m" | "15m" | "30m" | "1h" | "4h";
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type WyckoffEvent = {
  index: number;
  confirmed: number;
  price: number;
  name: string;
  dir: 1 | -1;
};

export type WyckoffRange = {
  left: number;
  right: number;
  low: number;
  high: number;
  dir: 1 | -1;
};

export type WyckoffScan = {
  acc: number[];
  dist: number[];
  events: WyckoffEvent[];
  history: WyckoffEvent[];
  range: WyckoffRange | null;
};

const TF: Record<Interval, number> = { "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400 };

type Pat = {
  dir: 1 | -1;
  st: number;
  cBar: number;
  cP: number;
  cVol: number;
  cRsi: number;
  rLow: number;
  rHigh: number;
  spP: number;
  sosBar: number;
  sosPeak: number;
  sosVol: number;
  lpsP: number;
  own: WyckoffEvent[];
};

function emptyPat(dir: 1 | -1): Pat {
  return {
    dir,
    st: 0,
    cBar: -1,
    cP: Number.NaN,
    cVol: Number.NaN,
    cRsi: Number.NaN,
    rLow: Number.NaN,
    rHigh: Number.NaN,
    spP: Number.NaN,
    sosBar: -1,
    sosPeak: Number.NaN,
    sosVol: Number.NaN,
    lpsP: Number.NaN,
    own: [],
  };
}

function rma(values: number[], len: number): number[] {
  const out = values.map(() => Number.NaN);
  if (values.length < len) return out;
  let seed = 0;
  for (let i = 0; i < len; i += 1) seed += values[i];
  let prev = seed / len;
  out[len - 1] = prev;
  for (let i = len; i < values.length; i += 1) {
    prev = (prev * (len - 1) + values[i]) / len;
    out[i] = prev;
  }
  return out;
}

function rsi(closes: number[], len: number): number[] {
  const gain = closes.map(() => 0);
  const loss = closes.map(() => 0);
  for (let i = 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain[i] = diff;
    else loss[i] = -diff;
  }
  const avgG = rma(gain, len);
  const avgL = rma(loss, len);
  return closes.map((_, i) => {
    if (!Number.isFinite(avgG[i]) || !Number.isFinite(avgL[i])) return Number.NaN;
    if (avgL[i] === 0) return 100;
    const rs = avgG[i] / avgL[i];
    return 100 - 100 / (1 + rs);
  });
}

function ema(values: number[], len: number): number[] {
  const out = values.map(() => Number.NaN);
  if (values.length < len) return out;
  let seed = 0;
  for (let i = 0; i < len; i += 1) seed += values[i];
  let prev = seed / len;
  out[len - 1] = prev;
  const k = 2 / (len + 1);
  for (let i = len; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function sma(values: number[], len: number): number[] {
  const out = values.map(() => Number.NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= len) sum -= values[i - len];
    if (i >= len - 1) out[i] = sum / len;
  }
  return out;
}

function atr(candles: Candle[], len: number): number[] {
  const tr = candles.map((c, i) => {
    const prev = i > 0 ? candles[i - 1].close : c.close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return rma(tr, len);
}

function pivotAt(values: number[], index: number, len: number, mode: "high" | "low"): number | null {
  const p = index - len;
  if (p < len || index >= values.length) return null;
  const v = values[p];
  if (!Number.isFinite(v)) return null;
  for (let k = p - len; k <= p + len; k += 1) {
    if (k === p) continue;
    const other = values[k];
    if (!Number.isFinite(other)) return null;
    if (mode === "high" ? other >= v : other <= v) return null;
  }
  return v;
}

function window3(values: number[], pivot: number, mode: "max" | "min"): number {
  let best = mode === "max" ? -Infinity : Infinity;
  let count = 0;
  for (let k = pivot - 1; k <= pivot + 1; k += 1) {
    if (k < 0 || k >= values.length || !Number.isFinite(values[k])) continue;
    count += 1;
    best = mode === "max" ? Math.max(best, values[k]) : Math.min(best, values[k]);
  }
  return count > 0 ? best : Number.NaN;
}

function phaseName(st: number, dir: 1 | -1): string {
  const acc = dir === 1;
  if (st === 1) return acc ? "A (SC)" : "A (BC)";
  if (st === 2) return "A (AR)";
  if (st === 3) return "B (ST)";
  if (st === 4) return acc ? "C (Spring)" : "C (UT)";
  if (st === 5) return acc ? "D (SOS)" : "D (SOW)";
  if (st === 6) return acc ? "D (LPS)" : "D (LPSY)";
  if (st === 7) return acc ? "E (Markup)" : "E (Markdown)";
  return "";
}

export function describeWyckoff(acc: number, dist: number): string {
  if (acc > 0) return `Tích lũy Phase ${phaseName(acc, 1)}`;
  if (dist > 0) return `Phân phối Phase ${phaseName(dist, -1)}`;
  return "Chưa có sơ đồ Wyckoff";
}

export function wyckoffSide(acc: number, dist: number, side: Side): { ok: boolean; text: string } {
  const phase = describeWyckoff(acc, dist);
  if (acc <= 0 && dist <= 0) return { ok: false, text: "Chưa có sơ đồ Wyckoff, chưa vào lệnh." };
  const accReady = acc >= 4;
  const distReady = dist >= 4;
  if (side === "LONG") {
    if (distReady) return { ok: false, text: `${phase}. Không LONG sau UT/SOW.` };
    if (accReady) return { ok: true, text: `${phase}. LONG cùng Spring/SOS.` };
    return { ok: true, text: `${phase}. Đã có sơ đồ, chưa tới Spring/UT.` };
  }
  if (accReady) return { ok: false, text: `${phase}. Không SHORT sau Spring/SOS.` };
  if (distReady) return { ok: true, text: `${phase}. SHORT cùng UT/SOW.` };
  return { ok: true, text: `${phase}. Đã có sơ đồ, chưa tới Spring/UT.` };
}

export function scanWyckoff(candles: Candle[], interval: Interval): WyckoffScan {
  const n = candles.length;
  const accState = candles.map(() => 0);
  const distState = candles.map(() => 0);
  const events: WyckoffEvent[] = [];
  const history: WyckoffEvent[] = [];
  let range: WyckoffRange | null = null;
  if (n < 40) return { acc: accState, dist: distState, events, history, range };

  const tfs = TF[interval];
  const climaxMult = tfs <= 1800 ? 2.2 : tfs <= 3600 ? 2 : tfs <= 7200 ? 1.8 : tfs <= 14400 ? 1.5 : 1.3;
  const pivBase = tfs <= 300 ? 8 : tfs <= 1800 ? 7 : tfs <= 7200 ? 6 : tfs <= 14400 ? 5 : 4;
  const maxTR = tfs <= 1800 ? 250 : tfs <= 3600 ? 200 : tfs <= 7200 ? 150 : tfs <= 14400 ? 120 : 100;
  const emaFLen = tfs >= 86400 ? 20 : 50;
  const pivLen = Math.max(2, pivBase);
  const sens = 25;
  const arAtr = 2;
  const reqPhaseC = true;

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const vols = candles.map((c) => c.volume);
  const rsiV = rsi(closes, 14);
  const volMa = sma(vols, 30);
  const atrV = atr(candles, 14);
  const emaF = ema(closes, emaFLen);

  const acc = emptyPat(1);
  const dist = emptyPat(-1);

  const reset = (p: Pat, clean: boolean) => {
    if (clean) {
      for (const event of p.own) {
        const at = events.indexOf(event);
        if (at >= 0) events.splice(at, 1);
      }
      if (range && range.dir === p.dir) range = null;
    }
    p.own = [];
    p.st = 0;
    p.cBar = -1;
    p.cP = Number.NaN;
    p.cVol = Number.NaN;
    p.cRsi = Number.NaN;
    p.rLow = Number.NaN;
    p.rHigh = Number.NaN;
    p.spP = Number.NaN;
    p.sosBar = -1;
    p.sosPeak = Number.NaN;
    p.sosVol = Number.NaN;
    p.lpsP = Number.NaN;
  };

  const addEvent = (p: Pat, bar: number, priceT: number, name: string, confirmed: number) => {
    const event = { index: bar, confirmed, price: p.dir * priceT, name, dir: p.dir };
    p.own.push(event);
    events.push(event);
    history.push({ ...event });
  };

  const realHigh = (p: Pat) => (p.dir === 1 ? p.rHigh : -p.rLow);
  const realLow = (p: Pat) => (p.dir === 1 ? p.rLow : -p.rHigh);

  const step = (
    p: Pat,
    other: Pat,
    index: number,
    extP: number | null,
    oppP: number | null,
    closeT: number,
    hiT: number,
    emaT: number,
    rsiExtT: number,
    closePvT: number,
    closeNxT: number,
    emaPvT: number,
    volMax: number,
    volMaPv: number,
    atrPv: number,
    volPv: number,
    volume: number,
    volAvg: number,
  ) => {
    const pivotBar = index - pivLen;
    const isAcc = p.dir === 1;
    if (p.st > 0 && p.st < 7) {
      let failed = index - p.cBar > maxTR;
      if (p.st === 2 || p.st === 3) failed = failed || closeT < p.rLow - 2 * atrV[index];
      else if (p.st === 4) failed = failed || closeT < p.spP - 0.5 * atrV[index];
      else if (p.st === 5) failed = failed || closeT < p.rLow;
      else if (p.st === 6) failed = failed || closeT < p.lpsP - atrV[index];
      if (failed) reset(p, true);
    }
    if (p.st === 7 && closeT < emaT) reset(p, false);

    if (p.st === 1) {
      if (extP != null && extP < p.cP) reset(p, true);
      else if (oppP != null && Number.isFinite(atrPv) && oppP - p.cP >= arAtr * atrPv) {
        p.st = 2;
        p.rHigh = oppP;
        addEvent(p, pivotBar, oppP, "AR", index);
        range = { left: p.cBar, right: index, low: realLow(p), high: realHigh(p), dir: p.dir };
      }
    } else if (p.st === 2) {
      if (oppP != null && oppP > p.rHigh) p.rHigh = oppP;
      if (extP != null) {
        if (Number.isFinite(atrPv) && extP < p.cP - 0.5 * atrPv) reset(p, true);
        else if (extP <= p.rLow + 0.5 * (p.rHigh - p.rLow) && (volMax < p.cVol || rsiExtT > p.cRsi)) {
          p.st = 3;
          p.rLow = Math.min(p.rLow, extP);
          addEvent(p, pivotBar, extP, "ST", index);
        }
      }
    } else if (p.st === 3 && extP != null && extP < p.rLow) {
      const recovered = closePvT > p.rLow || closeNxT > p.rLow;
      if (Number.isFinite(atrPv) && extP >= p.rLow - 1.5 * atrPv && recovered) {
        p.st = 4;
        p.spP = extP;
        addEvent(p, pivotBar, extP, isAcc ? "Spring" : "UT", index);
      } else reset(p, true);
    }

    if ((p.st === 4 || (p.st === 3 && !reqPhaseC)) && closeT > p.rHigh && volume >= volAvg && closeT > emaT) {
      p.st = 5;
      p.sosBar = index;
      p.sosPeak = hiT;
      p.sosVol = volume;
      addEvent(p, index, hiT, isAcc ? "SOS" : "SOW", index);
    }

    if (p.st === 5) {
      if (
        extP != null &&
        pivotBar > p.sosBar &&
        extP > p.rLow + 0.5 * (p.rHigh - p.rLow) &&
        Number.isFinite(atrPv) &&
        extP < p.sosPeak - 0.5 * atrPv &&
        volPv < p.sosVol
      ) {
        p.st = 6;
        p.lpsP = extP;
        addEvent(p, pivotBar, extP, isAcc ? "LPS" : "LPSY", index);
      }
    } else if (p.st === 6 && closeT > p.sosPeak && closeT > emaT) {
      p.st = 7;
      addEvent(p, index, hiT, isAcc ? "Markup" : "Markdown", index);
      if (range && range.dir === p.dir) range = { ...range, right: index };
    }
    if ((p.st === 5 || p.st === 6) && hiT > p.sosPeak) p.sosPeak = hiT;
    if (p.st >= 2 && p.st <= 6 && range && range.dir === p.dir) {
      range = { left: p.cBar, right: index, low: realLow(p), high: realHigh(p), dir: p.dir };
    }

    if (
      p.st === 0 &&
      extP != null &&
      Number.isFinite(volMaPv) &&
      volMax >= volMaPv * climaxMult &&
      Number.isFinite(rsiExtT) &&
      rsiExtT <= sens &&
      Number.isFinite(emaPvT) &&
      closePvT < emaPvT
    ) {
      let blocked = false;
      if (other.st >= 3 && other.st <= 6) blocked = true;
      else if (other.st === 7) reset(other, false);
      else if (other.st > 0) reset(other, true);
      if (!blocked) {
        p.st = 1;
        p.cBar = pivotBar;
        p.cP = extP;
        p.cVol = volMax;
        p.cRsi = rsiExtT;
        p.rLow = extP;
        addEvent(p, pivotBar, extP, isAcc ? "SC" : "BC", index);
      }
    }
  };

  for (let i = pivLen * 2; i < n - 1; i += 1) {
    const ph = pivotAt(highs, i, pivLen, "high");
    const pl = pivotAt(lows, i, pivLen, "low");
    const pivot = i - pivLen;
    const volMax = window3(vols, pivot, "max");
    const rsiMin = window3(rsiV, pivot, "min");
    const rsiMax = window3(rsiV, pivot, "max");
    const atrPv = atrV[pivot];
    const volMaPv = volMa[pivot];
    const volPv = vols[pivot];
    const closePv = closes[pivot];
    const closeNx = closes[pivot + 1];
    const emaPv = emaF[pivot];
    if (Number.isFinite(atrV[i]) && Number.isFinite(emaF[i]) && Number.isFinite(volMa[i]) && Number.isFinite(rsiV[i])) {
      step(acc, dist, i, pl, ph, closes[i], highs[i], emaF[i], rsiMin, closePv, closeNx, emaPv, volMax, volMaPv, atrPv, volPv, vols[i], volMa[i]);
      step(
        dist,
        acc,
        i,
        ph == null ? null : -ph,
        pl == null ? null : -pl,
        -closes[i],
        -lows[i],
        -emaF[i],
        100 - rsiMax,
        -closePv,
        -closeNx,
        -emaPv,
        volMax,
        volMaPv,
        atrPv,
        volPv,
        vols[i],
        volMa[i],
      );
    }
    accState[i] = acc.st;
    distState[i] = dist.st;
  }
  if (n > 1) {
    accState[n - 1] = accState[n - 2] ?? 0;
    distState[n - 1] = distState[n - 2] ?? 0;
  }
  return { acc: accState, dist: distState, events, history, range };
}
