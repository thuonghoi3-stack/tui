export const INTERVALS = ["5m", "15m", "30m", "1h", "4h"] as const;
export type Interval = (typeof INTERVALS)[number];

export const INTERVAL_LABEL: Record<Interval, string> = {
  "5m": "5 phút",
  "15m": "15 phút",
  "30m": "30 phút",
  "1h": "1 giờ",
  "4h": "4 giờ",
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Side = "LONG" | "SHORT";
export type Tier = "confirmed" | "partial" | "filtered";
export type CheckState = "pass" | "fail" | "wait";

export type Params = {
  utKey: number;
  atrPeriod: number;
  smaLen: number;
  smaDist: number;
  smaLook: number;
  useExtreme: boolean;
  slPct: number;
  tpPct: number;
  whaleLookback: number;
  whaleBins: number;
  strengthPct: number;
  sessionMinBars: number;
  bullMin: number;
  bearMax: number;
  requireSession: boolean;
  requireWhale: boolean;
  requireSma: boolean;
};

export const defaultParams: Params = {
  utKey: 1,
  atrPeriod: 14,
  smaLen: 15,
  smaDist: 0.1,
  smaLook: 2,
  useExtreme: true,
  slPct: 6,
  tpPct: 3.2,
  whaleLookback: 200,
  whaleBins: 32,
  strengthPct: 97,
  sessionMinBars: 8,
  bullMin: 52,
  bearMax: 48,
  requireSession: true,
  requireWhale: true,
  requireSma: false,
};

export function clampParams(p: Params): Params {
  const num = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  return {
    utKey: num(p.utKey, 0.1, 8),
    atrPeriod: Math.round(num(p.atrPeriod, 1, 100)),
    smaLen: Math.round(num(p.smaLen, 2, 200)),
    smaDist: num(p.smaDist, 0, 20),
    smaLook: Math.round(num(p.smaLook, 0, 48)),
    useExtreme: Boolean(p.useExtreme),
    slPct: num(p.slPct, 0.1, 20),
    tpPct: num(p.tpPct, 0.1, 50),
    whaleLookback: Math.round(num(p.whaleLookback, 30, 500)),
    whaleBins: Math.round(num(p.whaleBins, 12, 48)),
    strengthPct: num(p.strengthPct, 80, 99),
    sessionMinBars: Math.round(num(p.sessionMinBars, 1, 80)),
    bullMin: num(p.bullMin, 50, 70),
    bearMax: num(p.bearMax, 30, 50),
    requireSession: Boolean(p.requireSession),
    requireWhale: Boolean(p.requireWhale),
    requireSma: Boolean(p.requireSma),
  };
}

export const SESSIONS = [
  { id: "sydney", name: "Sydney", start: 22, end: 7 },
  { id: "tokyo", name: "Tokyo", start: 0, end: 9 },
  { id: "london", name: "London", start: 8, end: 16 },
  { id: "newyork", name: "New York", start: 13, end: 22 },
] as const;

export function inWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function hourOf(ms: number): number {
  return new Date(ms).getUTCHours();
}

export function sessionsAt(ms: number): string[] {
  const hour = hourOf(ms);
  const names = SESSIONS.filter((s) => inWindow(hour, s.start, s.end)).map((s) => s.name);
  const order = ["New York", "London", "Tokyo", "Sydney"];
  return names.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export type HourStat = {
  hour: number;
  bars: number;
  range: number;
  volume: number;
  bull: number;
  drift: number;
  score: number;
  rangeRank: number;
  quiet: boolean;
  qualified: boolean;
};

export type SessionStat = {
  id: string;
  name: string;
  start: number;
  end: number;
  bars: number;
  range: number;
  bull: number;
  drift: number;
  rank: number;
};

export type WhaleBin = {
  low: number;
  high: number;
  buy: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  absorption: number;
  peak: boolean;
};

export type WhaleLevel = { mid: number; absorption: number } | null;

export type WhaleRead = {
  bins: WhaleBin[];
  min: number;
  max: number;
  maxVolume: number;
  maxAbsorption: number;
  priceBin: number;
  deltaNear: number;
  profileDelta: number;
  strongBuyNear: number;
  strongSellNear: number;
  support: WhaleLevel;
  resistance: WhaleLevel;
  longOk: boolean;
  shortOk: boolean;
  longText: string;
  shortText: string;
};

export type Marker = {
  index: number;
  side: Side;
  tier: Tier;
  provisional: boolean;
  smaOk: boolean;
  sessionOk: boolean;
  whaleOk: boolean;
  sessionRaw: boolean;
  whaleRaw: boolean;
  smaText: string;
  sessionText: string;
  whaleText: string;
  sessionRawText: string;
  whaleRawText: string;
};

export type Check = { label: string; state: CheckState; text: string };

export type FocusView = {
  headline: string;
  tone: "bull" | "bear" | "wait" | "muted";
  kicker: string;
  sub: string;
  time: number | null;
  side: Side | null;
  checks: Check[];
  entry: number | null;
  sl: number | null;
  tp: number | null;
  planNote: string | null;
  markerIndex: number | null;
};

export type Analysis = {
  stops: number[];
  sma: number[];
  upper: number[];
  lower: number[];
  markers: Marker[];
  hours: HourStat[];
  sessions: SessionStat[];
  whale: WhaleRead;
  live: FocusView;
  counts: { confirmedLong: number; confirmedShort: number; partial: number; filtered: number };
  lastConfirmed: { side: Side; time: number } | null;
  sessionsNow: string[];
  overlap: boolean;
};

export type Paper = {
  id: string;
  symbol: string;
  interval: Interval;
  side: Side;
  signalTime: number;
  entryTime: number;
  entry: number;
  sl: number;
  tp: number;
  status: "open" | "tp" | "sl";
  exit?: number;
  exitTime?: number;
  sessionNote?: string;
  whaleNote?: string;
};

type Acc = { bars: number; range: number; vol: number; drift: number; up: number; dir: number };

function emptyAcc(): Acc {
  return { bars: 0, range: 0, vol: 0, drift: 0, up: 0, dir: 0 };
}

function addBar(acc: Acc, c: Candle) {
  if (!(c.close > 0) || !(c.open > 0)) return;
  acc.bars += 1;
  acc.range += (Math.max(c.high - c.low, 0) / c.close) * 100;
  acc.vol += c.volume;
  acc.drift += ((c.close - c.open) / c.open) * 100;
  if (c.close !== c.open) {
    acc.dir += 1;
    if (c.close > c.open) acc.up += 1;
  }
}

function scale(values: number[]): number[] {
  const out = values.map(() => Number.NaN);
  const items = values.map((v, i) => ({ v, i })).filter((x) => Number.isFinite(x.v));
  if (items.length === 0) return out;
  const lo = Math.min(...items.map((x) => x.v));
  const hi = Math.max(...items.map((x) => x.v));
  for (const it of items) out[it.i] = hi === lo ? 50 : ((it.v - lo) / (hi - lo)) * 100;
  return out;
}

function summarizeHours(accs: Acc[], minBars: number): HourStat[] {
  const range = accs.map((a) => (a.bars > 0 ? a.range / a.bars : Number.NaN));
  const volume = accs.map((a) => (a.bars > 0 ? a.vol / a.bars : Number.NaN));
  const bull = accs.map((a) => (a.dir > 0 ? (100 * a.up) / a.dir : Number.NaN));
  const drift = accs.map((a) => (a.bars > 0 ? a.drift / a.bars : Number.NaN));
  const edge = bull.map((b) => (Number.isFinite(b) ? Math.abs(b - 50) : Number.NaN));
  const rangeP = scale(range.map((v, i) => (accs[i].bars >= minBars ? v : Number.NaN)));
  const volP = scale(volume.map((v, i) => (accs[i].bars >= minBars ? v : Number.NaN)));
  const edgeP = scale(edge.map((v, i) => (accs[i].bars >= minBars ? v : Number.NaN)));

  const qualified: number[] = [];
  for (let i = 0; i < 24; i += 1) {
    if (accs[i].bars >= minBars && Number.isFinite(range[i])) qualified.push(i);
  }
  qualified.sort((a, b) => range[b] - range[a]);
  const rank = Array(24).fill(0);
  qualified.forEach((h, i) => {
    rank[h] = i + 1;
  });
  const quietN = qualified.length < 4 ? 0 : Math.min(4, Math.max(1, Math.round(qualified.length * 0.17)));
  const quiet = new Set(qualified.slice(qualified.length - quietN));

  return accs.map((a, hour) => {
    const parts = [rangeP[hour], volP[hour], edgeP[hour]].filter((v) => Number.isFinite(v));
    const score = parts.length > 0 ? parts.reduce((s, v) => s + v, 0) / parts.length : Number.NaN;
    return {
      hour,
      bars: a.bars,
      range: range[hour],
      volume: volume[hour],
      bull: bull[hour],
      drift: drift[hour],
      score,
      rangeRank: rank[hour],
      quiet: quiet.has(hour),
      qualified: a.bars >= minBars,
    };
  });
}

function summarizeSessions(accs: Acc[]): SessionStat[] {
  const rows = SESSIONS.map((s, i) => {
    const a = accs[i];
    return {
      id: s.id,
      name: s.name,
      start: s.start,
      end: s.end,
      bars: a.bars,
      range: a.bars > 0 ? a.range / a.bars : Number.NaN,
      bull: a.dir > 0 ? (100 * a.up) / a.dir : Number.NaN,
      drift: a.bars > 0 ? a.drift / a.bars : Number.NaN,
      rank: 0,
    };
  });
  const order = rows
    .map((r, i) => ({ i, range: r.range }))
    .filter((r) => r.range > 0 || Number.isFinite(r.range))
    .filter((r) => rows[r.i].bars > 0)
    .sort((a, b) => b.range - a.range);
  order.forEach((r, idx) => {
    rows[r.i].rank = idx + 1;
  });
  return rows;
}

function atr(candles: Candle[], period: number): number[] {
  const out = candles.map(() => Number.NaN);
  if (candles.length < period) return out;
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1].close : c.close;
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev)));
  }
  let seed = 0;
  for (let i = 0; i < period; i += 1) seed += tr[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < candles.length; i += 1) {
    prev = (prev * (period - 1) + tr[i]) / period;
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

function windowExtreme(values: number[], index: number, need: number, mode: "min" | "max"): number | null {
  const start = Math.max(0, index - need + 1);
  let count = 0;
  let best = mode === "min" ? Infinity : -Infinity;
  for (let k = start; k <= index; k += 1) {
    if (!Number.isFinite(values[k])) continue;
    count += 1;
    best = mode === "min" ? Math.min(best, values[k]) : Math.max(best, values[k]);
  }
  if (count < need) return null;
  return best;
}

function emptyWhale(): WhaleRead {
  return {
    bins: [],
    min: Number.NaN,
    max: Number.NaN,
    maxVolume: 0,
    maxAbsorption: 0,
    priceBin: -1,
    deltaNear: 0,
    profileDelta: 0,
    strongBuyNear: 0,
    strongSellNear: 0,
    support: null,
    resistance: null,
    longOk: false,
    shortOk: false,
    longText: "Chưa đủ nến cho profile cá voi.",
    shortText: "Chưa đủ nến cho profile cá voi.",
  };
}

function readWhale(candles: Candle[], from: number, to: number, params: Params): WhaleRead {
  if (to < from || to - from < 8) return emptyWhale();
  let min = Infinity;
  let max = -Infinity;
  const vols: number[] = [];
  for (let i = from; i <= to; i += 1) {
    const c = candles[i];
    min = Math.min(min, c.low);
    max = Math.max(max, c.high);
    vols.push(c.volume);
  }
  if (!(max > min)) {
    const pad = Math.max(Math.abs(min) * 0.001, 1e-8);
    min -= pad;
    max += pad;
  }
  const binsN = params.whaleBins;
  const step = (max - min) / binsN;
  const bins: WhaleBin[] = Array.from({ length: binsN }, (_, i) => ({
    low: min + step * i,
    high: min + step * (i + 1),
    buy: 0,
    sell: 0,
    strongBuy: 0,
    strongSell: 0,
    absorption: 0,
    peak: false,
  }));
  const binOf = (price: number) => {
    const i = Math.floor((price - min) / step);
    return Math.max(0, Math.min(binsN - 1, i));
  };
  const add = (field: "buy" | "sell" | "strongBuy" | "strongSell" | "absorption", a: number, b: number, vol: number) => {
    if (!(vol > 0)) return;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const i0 = binOf(lo);
    const i1 = binOf(hi);
    const slice = vol / (i1 - i0 + 1);
    for (let i = i0; i <= i1; i += 1) bins[i][field] += slice;
  };

  const sorted = [...vols].sort((a, b) => a - b);
  const pIndex = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length * params.strengthPct) / 100)));
  const threshold = sorted[pIndex] ?? Infinity;

  for (let i = from; i <= to; i += 1) {
    const c = candles[i];
    const buyBar = c.close >= c.open;
    add(buyBar ? "buy" : "sell", c.low, c.high, c.volume);
    if (c.volume >= threshold) add(buyBar ? "strongBuy" : "strongSell", c.low, c.high, c.volume);
    const range = c.high - c.low;
    if (!(range > 0)) continue;
    const bodyTop = Math.max(c.open, c.close);
    const bodyBot = Math.min(c.open, c.close);
    if (c.close > c.open && c.high > bodyTop) {
      add("absorption", bodyTop, c.high, c.volume * ((c.high - bodyTop) / range));
    } else if (c.close < c.open && c.low < bodyBot) {
      add("absorption", c.low, bodyBot, c.volume * ((bodyBot - c.low) / range));
    }
  }

  let maxVolume = 0;
  let maxAbsorption = 0;
  let profileDelta = 0;
  for (const b of bins) {
    maxVolume = Math.max(maxVolume, b.buy + b.sell);
    maxAbsorption = Math.max(maxAbsorption, b.absorption);
    profileDelta += b.buy - b.sell;
  }
  const floor = maxAbsorption * 0.2;
  for (let i = 1; i < binsN - 1; i += 1) {
    const v = bins[i].absorption;
    bins[i].peak = v > bins[i - 1].absorption && v > bins[i + 1].absorption && v >= floor && v > 0;
  }

  const price = candles[to].close;
  const priceBin = binOf(price);
  let deltaNear = 0;
  let strongBuyNear = 0;
  let strongSellNear = 0;
  let buyNear = 0;
  let sellNear = 0;
  for (let i = Math.max(0, priceBin - 1); i <= Math.min(binsN - 1, priceBin + 1); i += 1) {
    deltaNear += bins[i].buy - bins[i].sell;
    strongBuyNear += bins[i].strongBuy;
    strongSellNear += bins[i].strongSell;
    buyNear += bins[i].buy;
    sellNear += bins[i].sell;
  }

  const nearest = (dir: -1 | 1): WhaleLevel => {
    for (let stepI = 1; stepI <= 5; stepI += 1) {
      const i = priceBin + dir * stepI;
      if (i < 0 || i >= binsN) break;
      if (bins[i].peak) return { mid: (bins[i].low + bins[i].high) / 2, absorption: bins[i].absorption };
    }
    return null;
  };
  const support = nearest(-1);
  const resistance = nearest(1);

  const nearVol = buyNear + sellNear;
  const deltaBias = nearVol > 0 ? deltaNear / nearVol : 0;
  const chase = 0.35;
  const note = (chasing: boolean, sideName: "mua" | "bán", absorb: boolean, flow: boolean) => {
    const pct = `${(deltaBias * 100).toFixed(0)}%`;
    if (chasing) return `Delta quanh giá đang ${sideName} quá mạnh (${pct}). Lệnh đảo không đuổi dòng này.`;
    const parts = [
      deltaBias <= -0.08 ? "Delta quanh giá nghiêng bán" : deltaBias >= 0.08 ? "Delta quanh giá nghiêng mua" : "Delta quanh giá không đuổi theo lệnh",
    ];
    if (absorb) parts.push(sideName === "mua" ? "Có hấp thụ đỡ phía dưới" : "Có hấp thụ cản phía trên");
    if (flow) parts.push(sideName === "mua" ? "Dòng mua gần giá" : "Dòng bán gần giá");
    return parts.join(" · ");
  };
  const longAbsorb = Boolean(support && (!resistance || support.absorption >= resistance.absorption));
  const shortAbsorb = Boolean(resistance && (!support || resistance.absorption >= support.absorption));
  const longFlow = strongBuyNear > strongSellNear && strongBuyNear > 0;
  const shortFlow = strongSellNear > strongBuyNear && strongSellNear > 0;
  const longChase = deltaBias >= chase;
  const shortChase = deltaBias <= -chase;

  return {
    bins,
    min,
    max,
    maxVolume,
    maxAbsorption,
    priceBin,
    deltaNear,
    profileDelta,
    strongBuyNear,
    strongSellNear,
    support,
    resistance,
    longOk: !longChase,
    shortOk: !shortChase,
    longText: note(longChase, "mua", longAbsorb, longFlow),
    shortText: note(shortChase, "bán", shortAbsorb, shortFlow),
  };
}

function explainSession(stats: HourStat[], time: number, side: Side, params: Params): { ok: boolean; text: string } {
  const names = sessionsAt(time);
  if (names.length === 0) return { ok: false, text: "Nến nằm ngoài các phiên đang theo dõi." };

  const pools = SESSIONS.map((session) => {
    let bars = 0;
    let range = 0;
    let drift = 0;
    let bull = 0;
    for (let h = 0; h < 24; h += 1) {
      if (!inWindow(h, session.start, session.end)) continue;
      const stat = stats[h];
      if (!stat || stat.bars <= 0) continue;
      bars += stat.bars;
      if (Number.isFinite(stat.range)) range += stat.range * stat.bars;
      if (Number.isFinite(stat.drift)) drift += stat.drift * stat.bars;
      if (Number.isFinite(stat.bull)) bull += stat.bull * stat.bars;
    }
    return {
      name: session.name,
      active: names.includes(session.name),
      bars,
      range: bars > 0 ? range / bars : Number.NaN,
      drift: bars > 0 ? drift / bars : Number.NaN,
      bull: bars > 0 ? bull / bars : Number.NaN,
    };
  });
  const active = pools.filter((pool) => pool.active && pool.bars >= params.sessionMinBars);
  const label = names.join(" · ");
  if (active.length === 0) {
    const thin = pools.filter((pool) => pool.active).reduce((max, pool) => Math.max(max, pool.bars), 0);
    return { ok: true, text: `${label} mới ${thin} nến, chưa đủ để chặn lệnh.` };
  }
  const driftVal = active.reduce((sum, pool) => sum + pool.drift, 0) / active.length;
  const rangeVal = active.reduce((sum, pool) => sum + pool.range, 0) / active.length;
  const bullVal = active.reduce((sum, pool) => sum + pool.bull, 0) / active.length;
  const bullText = `Bull ${bullVal.toFixed(0)}%`;
  const driftText = `drift ${driftVal >= 0 ? "+" : ""}${driftVal.toFixed(3)}%`;
  const withTrade = rangeVal > 0 ? (side === "LONG" ? driftVal : -driftVal) / rangeVal : 0;
  const bullWithTrade = side === "LONG" ? bullVal >= params.bullMin : bullVal <= params.bearMax;
  if (withTrade >= 0.1 && bullWithTrade) {
    return { ok: false, text: `${label} đang thuận chiều quá rõ · ${bullText} · ${driftText}. Không đuổi phiên.` };
  }
  return { ok: true, text: `${label} · ${bullText} · ${driftText} · không thuận chiều quá mức.` };
}

export function tradeLevels(entry: number, side: Side, params: Params): { entry: number; sl: number; tp: number } {
  const sl = side === "LONG" ? entry * (1 - params.slPct / 100) : entry * (1 + params.slPct / 100);
  const tp = side === "LONG" ? entry * (1 + params.tpPct / 100) : entry * (1 - params.tpPct / 100);
  return { entry, sl, tp };
}

function toneOf(headline: string): FocusView["tone"] {
  if (headline.includes("LONG")) return "bull";
  if (headline.includes("SHORT")) return "bear";
  if (headline === "CHỜ") return "wait";
  return "muted";
}

function gatesOpen(m: Marker, params: Params): boolean {
  if (!m.smaOk) return false;
  if (params.requireSession && !m.sessionRaw) return false;
  if (params.requireWhale && !m.whaleRaw) return false;
  return true;
}

export function focusOfMarker(m: Marker, candles: Candle[], params: Params): FocusView {
  const bookable = gatesOpen(m, params);
  const asked = [params.requireSession ? "phiên" : "", params.requireWhale ? "cá voi" : ""].filter(Boolean);
  const headline = bookable ? (m.provisional ? `TẠM ${m.side}` : m.side) : m.smaOk ? "CHỜ" : "LỌC";
  const kicker = bookable
    ? m.provisional
      ? "Đủ cổng trên nến chưa đóng"
      : asked.length
        ? `${asked[0].charAt(0).toUpperCase()}${asked.join(" và ").slice(1)} đã xác nhận`
        : "Đã tắt lọc phiên và cá voi"
    : m.smaOk
      ? "UT đạt, sổ giấy chưa được vào"
      : "UT đảo nhưng SMA loại";
  let entry = candles[m.index]?.close ?? Number.NaN;
  let planNote = bookable ? "Mức theo giá đóng nến tín hiệu. Chưa vào sổ vì thiếu nến sau." : "Không ghi sổ vì cổng đang bật chưa xác nhận.";
  if (m.provisional) {
    planNote = bookable
      ? "Các cổng đang bật đều đúng, nhưng nến chưa đóng nên chưa vào sổ."
      : "Nến đang chạy. Sổ giấy chỉ vào khi nến đóng và các cổng đang bật xác nhận.";
  } else if (m.index + 1 < candles.length) {
    entry = candles[m.index + 1].open;
    planNote = bookable
      ? "Đã qua các cổng đang bật trên nến đóng. Khớp ở giá mở nến sau. Nếu một nến chạm cả SL và TP, tính SL trước."
      : "Không vào lệnh. Cổng phiên hoặc cá voi đang bật nhưng chưa xác nhận.";
  } else if (!bookable) {
    planNote = "Không ghi sổ vì cổng đang bật chưa xác nhận.";
  }
  const levels = Number.isFinite(entry) && bookable ? tradeLevels(entry, m.side, params) : null;
  const sub = bookable
    ? m.provisional
      ? "Sẽ vào sổ khi nến đóng nếu các cổng đang bật còn đúng."
      : "Đủ điều kiện vào sổ giấy."
    : m.smaOk
      ? "Chưa phải lệnh. Bật phiên hoặc cá voi thì phải xác nhận đúng phía."
      : "Bỏ qua. Giá chưa từng cách SMA đủ trong cửa sổ nhìn lại.";
  return {
    headline,
    tone: toneOf(headline),
    kicker,
    sub,
    time: candles[m.index]?.time ?? null,
    side: m.side,
    checks: [
      { label: "UT + SMA", state: m.smaOk ? "pass" : "fail", text: m.smaText },
      {
        label: "Phiên",
        state: params.requireSession ? (m.sessionRaw ? "pass" : "fail") : "pass",
        text: params.requireSession ? m.sessionRawText : `Đã tắt lọc phiên. ${m.sessionRawText}`,
      },
      {
        label: "Cá voi",
        state: params.requireWhale ? (m.whaleRaw ? "pass" : "fail") : "pass",
        text: params.requireWhale ? m.whaleRawText : `Đã tắt lọc cá voi. ${m.whaleRawText}`,
      },
    ],
    entry: levels?.entry ?? null,
    sl: levels?.sl ?? null,
    tp: levels?.tp ?? null,
    planNote,
    markerIndex: m.index,
  };
}

function emptyFocus(text: string): FocusView {
  return {
    headline: "ĐỢI",
    tone: "muted",
    kicker: "Chưa đủ dữ liệu",
    sub: text,
    time: null,
    side: null,
    checks: [],
    entry: null,
    sl: null,
    tp: null,
    planNote: null,
    markerIndex: null,
  };
}

export function analyze(candles: Candle[], rawParams: Params): Analysis {
  const params = clampParams(rawParams);
  const n = candles.length;
  const stops = candles.map(() => Number.NaN);
  const closes = candles.map((c) => c.close);
  const smaLine = sma(closes, params.smaLen);
  const upper = smaLine.map((v) => (Number.isFinite(v) ? v * (1 + params.smaDist / 100) : Number.NaN));
  const lower = smaLine.map((v) => (Number.isFinite(v) ? v * (1 - params.smaDist / 100) : Number.NaN));
  const atrLine = atr(candles, params.atrPeriod);

  const hourRun = Array.from({ length: 24 }, () => emptyAcc());
  const sessRun = Array.from({ length: 4 }, () => emptyAcc());
  const hourPref: Acc[][] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const c = candles[i];
    const hour = hourOf(c.time);
    addBar(hourRun[hour], c);
    for (let s = 0; s < SESSIONS.length; s += 1) {
      if (inWindow(hour, SESSIONS[s].start, SESSIONS[s].end)) addBar(sessRun[s], c);
    }
    hourPref[i] = hourRun.map((a) => ({ ...a }));
  }

  const hours = n > 0 ? summarizeHours(hourPref[n - 1], params.sessionMinBars) : summarizeHours(hourRun, params.sessionMinBars);
  const sessions = summarizeSessions(sessRun);

  const devLow = candles.map((c, i) => {
    const base = smaLine[i];
    if (!(base > 0)) return Number.NaN;
    const px = params.useExtreme ? c.low : c.close;
    return (px / base - 1) * 100;
  });
  const devHigh = candles.map((c, i) => {
    const base = smaLine[i];
    if (!(base > 0)) return Number.NaN;
    const px = params.useExtreme ? c.high : c.close;
    return (px / base - 1) * 100;
  });

  const buy = candles.map(() => false);
  const sell = candles.map(() => false);
  let prevStop = 0;
  for (let i = 0; i < n; i += 1) {
    if (!Number.isFinite(atrLine[i])) continue;
    const src = candles[i].close;
    const srcPrev = i > 0 ? candles[i - 1].close : src;
    const nLoss = params.utKey * atrLine[i];
    let next: number;
    if (src > prevStop && srcPrev > prevStop) next = Math.max(prevStop, src - nLoss);
    else if (src < prevStop && srcPrev < prevStop) next = Math.min(prevStop, src + nLoss);
    else if (src > prevStop) next = src - nLoss;
    else next = src + nLoss;
    stops[i] = next;
    const prevCross = i > 0 && Number.isFinite(stops[i - 1]) ? stops[i - 1] : prevStop;
    if (i > 0 && Number.isFinite(smaLine[i])) {
      if (src > next && srcPrev <= prevCross) buy[i] = true;
      else if (src < next && srcPrev >= prevCross) sell[i] = true;
    }
    prevStop = next;
  }

  const need = params.smaLook + 1;
  const markers: Marker[] = [];
  const whaleCache = new Map<number, WhaleRead>();
  const whaleAt = (index: number) => {
    const hit = whaleCache.get(index);
    if (hit) return hit;
    const from = Math.max(0, index - params.whaleLookback + 1);
    const read = readWhale(candles, from, index, params);
    whaleCache.set(index, read);
    return read;
  };
  const whaleInWindow = (index: number, side: Side) => {
    const now = whaleAt(index);
    return {
      ok: side === "LONG" ? now.longOk : now.shortOk,
      text: side === "LONG" ? now.longText : now.shortText,
    };
  };

  const pushMarker = (index: number, side: Side, provisional: boolean) => {
    const stats = summarizeHours(hourPref[index], params.sessionMinBars);
    const lowExt = windowExtreme(devLow, index, need, "min");
    const highExt = windowExtreme(devHigh, index, need, "max");
    const smaRaw = side === "LONG" ? lowExt != null && lowExt <= -params.smaDist : highExt != null && highExt >= params.smaDist;
    const smaOk = params.requireSma ? smaRaw : true;
    const measure = params.useExtreme ? (side === "LONG" ? "low" : "high") : "giá đóng";
    const smaDetail = smaRaw
      ? `Trong ${need} nến, ${measure} từng cách SMA ${params.smaLen} ít nhất ${params.smaDist}%.`
      : `Chưa đủ khoảng cách ${params.smaDist}% so với SMA ${params.smaLen} trong ${need} nến.`;
    const smaText = params.requireSma ? smaDetail : `Đã tắt lọc cách SMA. ${smaDetail}`;
    const sessionEval = explainSession(stats, candles[index].time, side, params);
    const sessionRaw = sessionEval.ok;
    const sessionOk = params.requireSession ? sessionRaw : true;
    const sessionText = params.requireSession ? sessionEval.text : `Đã tắt lọc phiên trên biểu đồ. ${sessionEval.text}`;
    const whaleEval = whaleInWindow(index, side);
    const whaleRaw = whaleEval.ok;
    const whaleOk = params.requireWhale ? whaleRaw : true;
    const whaleRawText = whaleEval.text;
    const whaleText = params.requireWhale ? whaleRawText : `Đã tắt lọc cá voi trên biểu đồ. ${whaleRawText}`;
    let tier: Tier = "filtered";
    if (smaOk && sessionOk && whaleOk) tier = "confirmed";
    else if (smaOk) tier = "partial";
    markers.push({
      index,
      side,
      tier,
      provisional,
      smaOk,
      sessionOk,
      whaleOk,
      sessionRaw,
      whaleRaw,
      smaText,
      sessionText,
      whaleText,
      sessionRawText: sessionEval.text,
      whaleRawText,
    });
  };

  for (let i = 0; i < n; i += 1) {
    const provisional = i === n - 1;
    if (buy[i]) pushMarker(i, "LONG", provisional);
    else if (sell[i]) pushMarker(i, "SHORT", provisional);
  }

  const counts = { confirmedLong: 0, confirmedShort: 0, partial: 0, filtered: 0 };
  let lastConfirmed: Analysis["lastConfirmed"] = null;
  for (const m of markers) {
    if (m.provisional) continue;
    const bookable = gatesOpen(m, params);
    if (bookable && m.side === "LONG") counts.confirmedLong += 1;
    else if (bookable && m.side === "SHORT") counts.confirmedShort += 1;
    else if (m.smaOk) counts.partial += 1;
    else counts.filtered += 1;
    if (bookable) lastConfirmed = { side: m.side, time: candles[m.index].time };
  }

  const whale = n > 0 ? whaleAt(n - 1) : emptyWhale();
  const last = n - 1;
  const sessionsNow = n > 0 ? sessionsAt(candles[last].time) : [];
  const overlap = n > 0 && sessionsNow.includes("London") && sessionsNow.includes("New York");

  let live = emptyFocus("Chưa có nến.");
  if (n > 1 && Number.isFinite(stops[last]) && Number.isFinite(smaLine[last])) {
    const provisional = markers.find((m) => m.provisional);
    const closedCut = n - 2;
    let recent: Marker | null = null;
    for (let i = markers.length - 1; i >= 0; i -= 1) {
      const m = markers[i];
      if (m.provisional) continue;
      if (m.index >= closedCut - 2) recent = m;
      break;
    }
    const chosen = provisional ?? recent;
    if (chosen) {
      live = focusOfMarker(chosen, candles, params);
    } else {
      const trendUp = candles[last].close > stops[last];
      const next: Side = trendUp ? "SHORT" : "LONG";
      const sessionEval = explainSession(hours, candles[last].time, next, params);
      const whaleEval = whaleInWindow(last, next);
      const lowExt = windowExtreme(devLow, last, need, "min");
      const highExt = windowExtreme(devHigh, last, need, "max");
      const smaRaw = next === "LONG" ? lowExt != null && lowExt <= -params.smaDist : highExt != null && highExt >= params.smaDist;
      const dist = (candles[last].close / smaLine[last] - 1) * 100;
      const distTxt = `${dist >= 0 ? "+" : ""}${dist.toFixed(2)}%`;
      const gates = (!params.requireSession || sessionEval.ok) && (!params.requireWhale || whaleEval.ok);
      const smaLineText = params.requireSma
        ? smaRaw
          ? `Điều kiện SMA cho ${next} đã có trong ${need} nến.`
          : `Điều kiện SMA cho ${next} chưa có.`
        : `Đã tắt lọc cách SMA. ${smaRaw ? "Khoảng cách vẫn đủ." : "Khoảng cách chưa đủ."}`;
      live = {
        headline: "ĐỢI",
        tone: "muted",
        kicker: trendUp ? "UT đang ở pha tăng" : "UT đang ở pha giảm",
        sub: `Lệnh kế tiếp là ${next}. ${
          params.requireSma ? (smaRaw ? "Khoảng cách SMA đã đủ." : "Khoảng cách SMA chưa đủ.") : "Đã tắt lọc cách SMA."
        } ${
          gates ? "Phiên và cá voi đang xác nhận phía đó — vẫn chưa vào sổ vì chưa có đảo UT." : "Chưa vào sổ: phiên hoặc cá voi chưa xác nhận phía đó."
        }`,
        time: candles[last].time,
        side: next,
        checks: [
          {
            label: "UT + SMA",
            state: "wait",
            text: `Chưa đảo chiều. Giá cách SMA ${distTxt}, dải ±${params.smaDist}%. ${smaLineText}`,
          },
          {
            label: "Phiên",
            state: params.requireSession ? (sessionEval.ok ? "pass" : "fail") : "pass",
            text: params.requireSession ? sessionEval.text : `Đã tắt lọc phiên. ${sessionEval.text}`,
          },
          {
            label: "Cá voi",
            state: params.requireWhale ? (whaleEval.ok ? "pass" : "fail") : "pass",
            text: params.requireWhale ? whaleEval.text : `Đã tắt lọc cá voi. ${whaleEval.text}`,
          },
        ],
        entry: null,
        sl: null,
        tp: null,
        planNote: null,
        markerIndex: null,
      };
    }
  }

  return {
    stops,
    sma: smaLine,
    upper,
    lower,
    markers,
    hours,
    sessions,
    whale,
    live,
    counts,
    lastConfirmed,
    sessionsNow,
    overlap,
  };
}

export function changePct(candles: Candle[], interval: Interval): number {
  const back = interval === "5m" ? 288 : interval === "15m" ? 96 : interval === "30m" ? 48 : interval === "1h" ? 24 : 6;
  if (candles.length < 2) return Number.NaN;
  const prev = candles[Math.max(0, candles.length - 1 - back)]?.close;
  const last = candles[candles.length - 1]?.close;
  if (!(prev && last)) return Number.NaN;
  return ((last - prev) / prev) * 100;
}

export function papersFrom(symbol: string, interval: Interval, candles: Candle[], analysis: Analysis, params: Params): Paper[] {
  const out: Paper[] = [];
  for (const m of analysis.markers) {
    if (m.provisional || !gatesOpen(m, params)) continue;
    const signal = candles[m.index];
    if (!signal) continue;
    const entryIndex = m.index + 1;
    if (entryIndex >= candles.length) continue;
    const entry = candles[entryIndex].open;
    const entryTime = candles[entryIndex].time;
    if (!(entry > 0)) continue;
    const levels = tradeLevels(entry, m.side, params);
    let status: Paper["status"] = "open";
    let exit: number | undefined;
    let exitTime: number | undefined;
    for (let i = entryIndex; i < candles.length; i += 1) {
      const c = candles[i];
      if (m.side === "LONG") {
        if (c.low <= levels.sl) {
          status = "sl";
          exit = levels.sl;
          exitTime = c.time;
          break;
        }
        if (c.high >= levels.tp) {
          status = "tp";
          exit = levels.tp;
          exitTime = c.time;
          break;
        }
      } else {
        if (c.high >= levels.sl) {
          status = "sl";
          exit = levels.sl;
          exitTime = c.time;
          break;
        }
        if (c.low <= levels.tp) {
          status = "tp";
          exit = levels.tp;
          exitTime = c.time;
          break;
        }
      }
    }
    const names = sessionsAt(signal.time);
    out.push({
      id: `${symbol}|${interval}|${signal.time}|${m.side}`,
      symbol,
      interval,
      side: m.side,
      signalTime: signal.time,
      entryTime,
      entry: levels.entry,
      sl: levels.sl,
      tp: levels.tp,
      status,
      exit,
      exitTime,
      sessionNote: names.length ? `${names.join(" · ")} · ${m.sessionRawText}` : m.sessionRawText,
      whaleNote: m.whaleRawText,
    });
  }
  return out;
}

export function mergeJournal(prev: Paper[], fresh: Paper[], covered: string[] = []): Paper[] {
  const coveredSet = new Set(covered);
  const freshIds = new Set(fresh.map((p) => p.id));
  const map = new Map<string, Paper>();
  for (const p of prev) {
    if (coveredSet.has(`${p.symbol}|${p.interval}`) && !freshIds.has(p.id)) continue;
    map.set(p.id, p);
  }
  for (const p of fresh) map.set(p.id, p);
  return [...map.values()].sort((a, b) => b.signalTime - a.signalTime).slice(0, 80);
}

export function pnlPct(p: Paper, mark?: number): number {
  const exit = p.status === "open" ? mark : p.exit;
  if (!(exit && p.entry)) return Number.NaN;
  const raw = p.side === "LONG" ? (exit - p.entry) / p.entry : (p.entry - exit) / p.entry;
  return raw * 100;
}

export function normalizeSymbol(raw: string): string {
  let s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return "";
  if (!s.endsWith("USDT") && !s.endsWith("USDC") && !s.endsWith("FDUSD")) s += "USDT";
  return s;
}
