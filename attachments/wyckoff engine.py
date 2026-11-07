# -*- coding: utf-8 -*-
"""
wyckoff_engine.py
=================
Port Python của lõi phát hiện cấu trúc trong indicator Pine "Wyckoff [theUltimator5]".

Đã port (logic giữ nguyên theo Pine, tên biến/hằng số giữ nguyên để dễ đối chiếu):
  - Climax SC/BC + xác nhận absorption, AR, ST  -> Phase A -> B
  - Phase B (đếm test, traversal, opposite-edge, "cause")
  - Spring / UTAD (kể cả provisional), Test, Terminal test (C-Test)  -> Phase C
  - SOS / SOW -> Phase D, LPS / LPSY, chấp nhận ngoài range -> Phase E
  - Reset / demote / stale, regime markup-markdown
  - Entry qualification (Conservative / Standard / Aggressive)

KHÔNG port (chỉ phục vụ hiển thị trên TradingView): schematic panel/overlay, label, bảng,
PS/PSY (preliminary support/supply), quét đa khung HTF, alert.

Ghi chú về độ lệch có thể có so với TradingView:
  * ta.pivothigh/pivotlow: ở đây dùng so sánh >= / <= (hòa giá vẫn tính là pivot).
  * Engine có trạng thái (state machine) -> kết quả phụ thuộc điểm bắt đầu của dữ liệu.
    Hãy cung cấp đủ nến khởi động (startup_candle_count >= ~1500).
  * Không có nến xác nhận intrabar: mọi tín hiệu tính trên nến đã đóng.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from types import SimpleNamespace

import numpy as np
import pandas as pd

NAN = float("nan")


def na(x):
    return x != x


def nz(x, d=0.0):
    return d if x != x else x


def pround(x):
    return int(math.floor(x + 0.5))


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


# ============================== HẰNG SỐ (khớp Pine) ==============================
DIR_NONE, DIR_ACCUM, DIR_DIST = 0, 1, -1
REGIME_NONE, REGIME_MARKUP, REGIME_MARKDOWN = 0, 1, -1
PHASE_NONE, PHASE_A, PHASE_B, PHASE_C, PHASE_D, PHASE_E = 0, 1, 2, 3, 4, 5

EV_NONE, EV_SC, EV_BC, EV_AR, EV_ST, EV_SPRING, EV_UTAD, EV_TEST = 0, 1, 2, 3, 4, 5, 6, 7
EV_SOS, EV_SOW, EV_LPS, EV_LPSY, EV_CTEST_ACC, EV_CTEST_DST, EV_MARKUP, EV_MARKDOWN = 8, 9, 10, 11, 12, 13, 14, 15

TEST_NONE, TEST_GOOD, TEST_POOR, TEST_FAILED = 0, 1, 2, 3
ENTRY_NONE, ENTRY_TEST, ENTRY_STRENGTH, ENTRY_LPS, ENTRY_PHASE_E = 0, 1, 2, 3, 4

BIT_SC, BIT_BC, BIT_AR, BIT_ST = 2, 4, 8, 16
BIT_SPRING, BIT_UTAD, BIT_TEST, BIT_SOS, BIT_SOW = 32, 64, 128, 256, 512
BIT_LPS, BIT_LPSY, BIT_E, BIT_CTEST = 1024, 2048, 4096, 16384

RS_INVALID, RS_ABSORB, RS_NORANGE, RS_DEPART, RS_STALE, RS_DEMOTE, RS_EEND = 0, 1, 2, 3, 4, 5, 6

# Structure detection
PIVOT_LEN = 4
ADAPTIVE_SWING = True            # swingModeInput == "ATR Adaptive"
ADAPTIVE_SWING_MIN = 2
ADAPTIVE_SWING_MAX = 10
ADAPTIVE_SWING_VOL_LEN = 50
TREND_LEN = 25
PRIOR_TREND_MAX_BARS = 200
PRIOR_TREND_PIVOT_FACTOR = 8.0
PRIOR_TREND_STRONG = 35.0
PRIOR_TREND_NEUTRAL = 15.0
CONTINUATION_TREND_LEN = 200
OPPOSITE_CYCLE_MIN_BARS = 25
EXTREME_LEN = 30

# Campaign lifecycle
PHASE_A_MIN_BARS = 6
PHASE_A_AFTER_AR_MAX_BARS = 45
PHASE_B_IDLE_MAX_BARS = 125
PHASE_C_IDLE_MAX_BARS = 50
PHASE_A_PREMATURE_DEPARTURE_TR_FRAC = 0.30
PHASE_A_PREMATURE_DEPARTURE_ATR = 0.75
STRUCTURE_INVALIDATION_ATR = 0.50
PHASE_B_DEPARTURE_TR_FRAC = 0.35
PHASE_B_DEPARTURE_ATR = 0.75
PHASE_E_MAX_BARS = 300

# Volume / volatility
VOL_LEN = 50
ATR_LEN = 14
CLIMAX_VOL_MULT = 1.8
CLIMAX_SPREAD_MULT = 1.5
RELAXED_CLIMAX_FACTOR = 0.80

# Climax confirmation
SC_CLOSE_MIN = 0.35
BC_CLOSE_MAX = 0.65
CLIMAX_MIN_SCORE = 5
CLIMAX_ABSORPTION_MIN_BARS = 3
CLIMAX_ABSORPTION_MAX_BARS = 8
CLIMAX_ABSORPTION_EXTREME_ATR = 0.50
CLIMAX_ABSORPTION_REBOUND_ATR = 0.35
CLIMAX_ABSORPTION_VOL_FLOOR = 0.90

# AR / Phase B
MIN_AR_ATR = 2.0
MAX_AR_BARS = 30
AR_MAX_EXTENSION_ATR = 15.0
BOUNDARY_TOL_ATR = 0.75
ST_MAX_VOL_RATIO = 0.90
ST_MAX_SPREAD_RATIO = 0.90
ST_MIN_SCORE = 4
MIN_PHASE_B_BARS = 30
MIN_PHASE_B_TESTS = 2
MIN_PHASE_B_OPPOSITE_TESTS = 1
MIN_PHASE_B_TRAVERSALS = 2
PHASE_B_ZONE_FRAC = 0.25
PHASE_B_RANGE_MIN_ATR = 1.5
PHASE_B_RANGE_MAX_ATR = 8.0
PHASE_B_BAD_TEST_COOLDOWN_FACTOR = 2.0
PHASE_B_EDGE_EXPANSION_CAP = 0.15
TERMINAL_TEST_MIN_BARS_AFTER_ST = 3
TERMINAL_TEST_VOL_RATIO = 0.85
TERMINAL_TEST_SPREAD_RATIO = 0.85
TERMINAL_TEST_OTHER_MAX_RATIO = 1.05

# Phase C
EXCURSION_RECOVERY_BARS = 3
SPRING_MIN_PEN_ATR = 0.15
SPRING_MAX_PEN_ATR = 2.5
SPRING_CLOSE_MIN = 0.55
UTAD_CLOSE_MAX = 0.45
SPRING_EFFORT_MAX_MULT = 1.50
EXCURSION_MIN_SCORE = 3
TEST_TOL_ATR = 1.25
TEST_MAX_VOL_RATIO = 0.80
TEST_MAX_SPREAD_RATIO = 0.80
TEST_EXTREME_TOLERANCE_ATR = 0.15
TEST_MIN_SCORE = 2

# Phase D / E
PHASE_C_TO_D_MIN_BARS = 3
PHASE_D_MIN_BARS = 4
PHASE_D_VALIDATION_MIN = 60
PHASE_D_DOMINANCE_FRAC = 0.65
BREAK_ATR = 0.15
STRENGTH_VOL_MULT = 1.15
STRENGTH_SPREAD_ATR = 1.15
SOS_CLOSE_MIN = 0.65
SOW_CLOSE_MAX = 0.35
STRENGTH_MIN_SCORE = 3
SOS_MULTI_BAR_LEN = 5
SOS_MULTI_BAR_ATR = 2.0
SOS_MULTI_BAR_EFFORT = 1.10
LPS_BOUNDARY_ATR = 1.50
LPS_VOL_MULT = 1.00
LPS_SPREAD_ATR = 1.00
LPS_MIN_SCORE = 2
CONFIRM_BARS = 3
DIRECT_ACCEPTANCE_BARS = 5
DIRECT_ACCEPTANCE_CONFIDENCE = 75
MIN_CONFIDENCE_PHASE_C = 45
MIN_CONFIDENCE_PHASE_D = 55

# Entries
ENTRY_CFG = {
    "Conservative": dict(conf=75, tests=7, val=PHASE_D_VALIDATION_MIN),
    "Standard": dict(conf=60, tests=6, val=max(45, PHASE_D_VALIDATION_MIN - 10)),
    "Aggressive": dict(conf=55, tests=5, val=max(45, PHASE_D_VALIDATION_MIN - 10)),
}


# ============================== TRẠNG THÁI CAMPAIGN ==============================
@dataclass
class WS:
    stopSide: int = 0
    outcome: int = 0
    phase: int = 0
    ev: int = 0
    startBar: float = NAN
    pivLen: float = NAN
    birthTrend: float = NAN
    ctxBull: bool = False
    ctxBear: bool = False
    climaxBar: float = NAN
    climaxPrice: float = NAN
    climaxEff: float = NAN
    climaxSpr: float = NAN
    climaxATR: float = NAN
    absorbed: bool = False
    origHigh: float = NAN
    origLow: float = NAN
    rangeHigh: float = NAN
    rangeLow: float = NAN
    arRunPrice: float = NAN
    arRunBar: float = NAN
    arOK: bool = False
    arBar: float = NAN
    stCount: int = 0
    stN: int = 0
    stEffSum: float = 0.0
    stSprSum: float = 0.0
    lastGoodEff: float = NAN
    lastGoodSpr: float = NAN
    stBar: float = NAN
    stPrice: float = NAN
    edge1: float = NAN
    edge2: float = NAN
    edge3: float = NAN
    oppCount: int = 0
    opN: int = 0
    opEffSum: float = 0.0
    opSprSum: float = 0.0
    opLastBar: float = NAN
    opLastPrice: float = NAN
    travCount: int = 0
    lastZone: int = 0
    lastZoneBar: float = NAN
    lastBadBar: float = NAN
    bStartBar: float = NAN
    cReadyBar: float = NAN
    dStartBar: float = NAN
    eStartBar: float = NAN
    pend: bool = False
    pendEdge: int = 0
    pendStartBar: float = NAN
    pendExtBar: float = NAN
    pendExt: float = NAN
    pendEff: float = NAN
    pendSpr: float = NAN
    pendCoolBar: float = NAN
    provEdge: int = 0
    provBar: float = NAN
    provPrice: float = NAN
    provEff: float = NAN
    provSpr: float = NAN
    provScore: int = 0
    exc: bool = False
    excTested: bool = False
    excBar: float = NAN
    excPrice: float = NAN
    excEff: float = NAN
    excSpr: float = NAN
    excScore: int = 0
    testBar: float = NAN
    testPrice: float = NAN
    testScore: int = 0
    strBar: float = NAN
    strPrice: float = NAN
    strScore: int = 0
    lpsPrice: float = NAN
    lpsBar: float = NAN
    lpsScore: int = 0
    entryBar: float = NAN
    entryKind: int = 0
    outCount: int = 0
    lastEventBar: float = NAN
    lastActBar: float = NAN
    cfPrior: bool = False
    cfClimax: bool = False
    cfAR: bool = False
    cfST: bool = False
    cfExc: bool = False
    cfTest: bool = False
    cfStrength: bool = False
    cfLPS: bool = False
    cfAccept: bool = False


# ============================== HÀM CHỈ BÁO (khớp ta.* của Pine) ==============================
def _rma(x, n):
    out = np.full(len(x), np.nan)
    if len(x) < n:
        return out
    out[n - 1] = float(np.mean(x[:n]))
    alpha = 1.0 / n
    for k in range(n, len(x)):
        out[k] = alpha * x[k] + (1.0 - alpha) * out[k - 1]
    return out


rma = _rma  # public alias (dùng trong strategy)


def _roll(x, n, fn):
    return getattr(pd.Series(x).rolling(n), fn)().to_numpy(dtype=float)


def _shift(x, k):
    out = np.full(len(x), np.nan)
    if k < len(x):
        out[k:] = x[: len(x) - k]
    return out


def _lag_nz(x, k):
    """nz(x[k], x): giá trị cách k nến, nếu không có thì dùng giá trị hiện tại."""
    out = x.copy()
    if k < len(x):
        out[k:] = x[: len(x) - k]
    return out


class WyckoffEngine:
    def __init__(self, strictness="Standard", tf_seconds=900.0, mintick=None):
        if strictness not in ENTRY_CFG:
            raise ValueError("strictness phải là Conservative / Standard / Aggressive")
        self.strictness = strictness
        self.tf_seconds = float(tf_seconds)
        self.mintick = mintick

    # ------------------------------------------------------------------ chuẩn bị dữ liệu
    def _prepare(self, df):
        o = df["open"].to_numpy(float)
        h = df["high"].to_numpy(float)
        l = df["low"].to_numpy(float)
        c = df["close"].to_numpy(float)
        v = np.nan_to_num(df["volume"].to_numpy(float)) if "volume" in df else np.zeros(len(c))
        n = len(c)
        mt = self.mintick if self.mintick else max(float(np.nanmedian(np.abs(c))) * 1e-6, 1e-10)
        self.mt = mt

        with np.errstate(all="ignore"):
            no_vol = np.cumsum(v) <= 0.0
            spr = np.maximum(h - l, mt)
            eff = np.where(no_vol, spr, v)
            avg_eff_raw = _roll(eff, VOL_LEN, "mean")
            avg_eff = np.where(np.isnan(avg_eff_raw), eff, avg_eff_raw)
            prev = _shift(avg_eff_raw, 1)
            avg_eff_prev = np.where(np.isnan(prev), avg_eff, prev)

            c_prev = _shift(c, 1)
            tr = np.where(np.isnan(c_prev), h - l,
                          np.maximum(h - l, np.maximum(np.abs(h - c_prev), np.abs(l - c_prev))))
            atr_raw = _rma(tr, ATR_LEN)
            a = np.where(np.isnan(atr_raw), spr, atr_raw)
            ap = _shift(atr_raw, 1)
            a_prev = np.where(np.isnan(ap), a, ap)
            unit = np.maximum(a, mt)
            c_pos = (c - l) / spr
            rel_e = eff / np.maximum(avg_eff, 1e-10)
            spr_atr = spr / unit

            recent_eff = _roll(eff, CLIMAX_ABSORPTION_MIN_BARS, "mean")
            recent_low = _roll(l, CLIMAX_ABSORPTION_MIN_BARS, "min")
            recent_high = _roll(h, CLIMAX_ABSORPTION_MIN_BARS, "max")
            prior_lo = _shift(_roll(l, EXTREME_LEN, "min"), 1)
            prior_hi = _shift(_roll(h, EXTREME_LEN, "max"), 1)
            eff_hi_prior = _shift(_roll(eff, EXTREME_LEN, "max"), 1)
            new_low = (~np.isnan(prior_lo)) & (l <= prior_lo)
            new_high = (~np.isnan(prior_hi)) & (h >= prior_hi)

            a_base = _roll(a, ADAPTIVE_SWING_VOL_LEN, "mean")
            a_ratio = np.where(np.nan_to_num(a_base) > 0.0, a / np.where(a_base > 0, a_base, 1.0), 1.0)
            adapt = np.clip(np.floor(PIVOT_LEN * a_ratio + 0.5), ADAPTIVE_SWING_MIN, ADAPTIVE_SWING_MAX).astype(int)
            live_len = adapt if ADAPTIVE_SWING else np.full(n, PIVOT_LEN, dtype=int)
            pre_len = live_len.copy()
            if n > 3:
                pre_len[3:] = live_len[:-3]

            long_sma = _roll(c, CONTINUATION_TREND_LEN, "mean")

            hi_c_inv = _roll(c, 2, "max"); lo_c_inv = _roll(c, 2, "min")
            hi_c_dep = _roll(c, 3, "max"); lo_c_dep = _roll(c, 3, "min")
            hi_c_a = hi_c_dep; lo_c_a = lo_c_dep
            hi_c_conf = _roll(c, CONFIRM_BARS, "max"); lo_c_conf = _roll(c, CONFIRM_BARS, "min")
            hi_c_dir = _roll(c, DIRECT_ACCEPTANCE_BARS, "max"); lo_c_dir = _roll(c, DIRECT_ACCEPTANCE_BARS, "min")
            hi_c_fail = hi_c_dep; lo_c_fail = lo_c_dep

            mb_low = _roll(l, SOS_MULTI_BAR_LEN, "min")
            mb_high = _roll(h, SOS_MULTI_BAR_LEN, "max")
            mb_eff_ratio = _roll(eff, SOS_MULTI_BAR_LEN, "sum") / np.maximum(avg_eff * SOS_MULTI_BAR_LEN, 1e-10)
            mb_sos = ((c - mb_low) / unit >= SOS_MULTI_BAR_ATR) & (mb_eff_ratio >= SOS_MULTI_BAR_EFFORT) & (c_pos >= 0.50)
            mb_sow = ((mb_high - c) / unit >= SOS_MULTI_BAR_ATR) & (mb_eff_ratio >= SOS_MULTI_BAR_EFFORT) & (c_pos <= 0.50)

            c1 = _lag_nz(c, 1); c2 = _lag_nz(c, 2); c3 = _lag_nz(c, 3)
            res3_up = np.maximum(c - c3, 0.0) / unit
            res3_dn = np.maximum(c3 - c, 0.0) / unit

            big_bull = (c > o) & (c - o >= a * 0.50)
            big_bear = (c < o) & (o - c >= a * 0.50)
            sos_score = ((rel_e >= STRENGTH_VOL_MULT).astype(int) + (spr_atr >= STRENGTH_SPREAD_ATR).astype(int)
                         + (c_pos >= SOS_CLOSE_MIN).astype(int) + big_bull.astype(int))
            sow_score = ((rel_e >= STRENGTH_VOL_MULT).astype(int) + (spr_atr >= STRENGTH_SPREAD_ATR).astype(int)
                         + (c_pos <= SOW_CLOSE_MAX).astype(int) + big_bear.astype(int))

        L = lambda x: x.tolist()
        self.D = SimpleNamespace(
            n=n, o=L(o), h=L(h), l=L(l), c=L(c), c_np=c, h_np=h, l_np=l, a_np=a, long_sma_np=long_sma,
            eff=L(eff), spr=L(spr), avg_eff_raw=L(avg_eff_raw), avg_eff=L(avg_eff), avg_eff_prev=L(avg_eff_prev),
            atr_raw=L(atr_raw), a=L(a), a_prev=L(a_prev), unit=L(unit), c_pos=L(c_pos), rel_e=L(rel_e),
            spr_atr=L(spr_atr), recent_eff=L(recent_eff), recent_low=L(recent_low), recent_high=L(recent_high),
            prior_lo=L(prior_lo), prior_hi=L(prior_hi), eff_hi_prior=L(eff_hi_prior),
            new_low=L(new_low), new_high=L(new_high), live_len=L(live_len), pre_len=L(pre_len),
            long_sma=L(long_sma),
            hi_c_inv=L(hi_c_inv), lo_c_inv=L(lo_c_inv), hi_c_a=L(hi_c_a), lo_c_a=L(lo_c_a),
            hi_c_dep=L(hi_c_dep), lo_c_dep=L(lo_c_dep), hi_c_conf=L(hi_c_conf), lo_c_conf=L(lo_c_conf),
            hi_c_dir=L(hi_c_dir), lo_c_dir=L(lo_c_dir), hi_c_fail=L(hi_c_fail), lo_c_fail=L(lo_c_fail),
            mb_sos=L(mb_sos), mb_sow=L(mb_sow), c1=L(c1), c2=L(c2),
            res3_up=L(res3_up), res3_dn=L(res3_dn), sos_score=L(sos_score), sow_score=L(sow_score),
        )
        self.ph_arr = np.full(n, np.nan)
        self.pl_arr = np.full(n, np.nan)

    # ------------------------------------------------------------------ trend score
    def _prior_trend(self, i, n, e):
        D = self.D
        n = max(n, 2)
        e = max(e, 0)
        i_end = i - e
        i_start = i - e - n
        if i_start < 0:
            return 0.0
        c_np = D.c_np
        c_end = c_np[i_end]
        c_start = c_np[i_start]
        unit_a = max(D.a[i_end], self.mt)
        net = c_end - c_start
        disp = clamp(net / (unit_a * math.sqrt(n)), -3.0, 3.0) * 15.0
        seg = c_np[i_start:i_end + 1]
        path = float(np.abs(np.diff(seg)).sum())
        phs = self.ph_arr[i_start + 1:i_end + 1]
        phs = phs[~np.isnan(phs)]
        pls = self.pl_arr[i_start + 1:i_end + 1]
        pls = pls[~np.isnan(pls)]
        hh = lh = hl = ll = 0
        if len(phs) >= 2:
            d = np.diff(phs)
            hh = int((d > 0).sum())
            lh = int((d < 0).sum())
        if len(pls) >= 2:
            d = np.diff(pls)
            hl = int((d > 0).sum())
            ll = int((d < 0).sum())
        er = abs(net) / path if path > 0 else 0.0
        er_part = (1.0 if net >= 0 else -1.0) * er * 25.0
        swings = hh + ll + lh + hl
        swing_part = (hh + hl - lh - ll) / swings * 20.0 if swings > 0 else 0.0
        sma_end = D.long_sma_np[i_end]
        sma_start = D.long_sma_np[i_start]
        if not (na(sma_end) or na(sma_start)):
            sma_part = 10.0 if sma_end > sma_start else (-10.0 if sma_end < sma_start else 0.0)
        else:
            sma_part = 0.0
        return clamp(disp + er_part + swing_part + sma_part, -100.0, 100.0)

    # ------------------------------------------------------------------ helper theo state
    def _set_event(self, s, ev):
        s.ev = ev
        s.lastEventBar = self.i
        s.lastActBar = self.i

    @staticmethod
    def _bias_dir(s):
        if s.stopSide == DIR_ACCUM:
            return DIR_DIST if s.ctxBear else DIR_ACCUM
        if s.stopSide == DIR_DIST:
            return DIR_ACCUM if s.ctxBull else DIR_DIST
        return DIR_NONE

    def _range_atr(self, s, atr_now):
        if not na(s.rangeHigh) and not na(s.rangeLow):
            return abs(s.rangeHigh - s.rangeLow) / max(nz(s.climaxATR, atr_now), self.mt)
        return 0.0

    @staticmethod
    def _hard_level(s, side):
        if side == DIR_ACCUM:
            if s.exc and s.outcome == DIR_ACCUM and not na(s.excPrice):
                return s.excPrice
            if na(s.origLow):
                return s.rangeLow
            return min(s.origLow, nz(s.rangeLow, s.origLow))
        if s.exc and s.outcome == DIR_DIST and not na(s.excPrice):
            return s.excPrice
        if na(s.origHigh):
            return s.rangeHigh
        return max(s.origHigh, nz(s.rangeHigh, s.origHigh))

    def _seed(self, s, side, pre_len, trend, bull, bear, a, eff, spr, l, h):
        i = self.i
        s.stopSide = side
        s.phase = PHASE_A
        s.startBar = i
        s.pivLen = pre_len
        s.birthTrend = trend
        s.ctxBull = bull
        s.ctxBear = bear
        s.climaxBar = i
        s.climaxPrice = l if side == DIR_ACCUM else h
        s.climaxEff = eff
        s.climaxSpr = spr
        s.climaxATR = a
        if side == DIR_ACCUM:
            s.origLow = l
            s.rangeLow = l
        else:
            s.origHigh = h
            s.rangeHigh = h
        s.cfPrior = True
        self._set_event(s, EV_SC if side == DIR_ACCUM else EV_BC)

    @staticmethod
    def _freeze_ar(s):
        s.arBar = s.arRunBar
        s.cfAR = True
        if s.stopSide == DIR_ACCUM:
            s.origHigh = s.arRunPrice
            s.rangeHigh = s.arRunPrice
        else:
            s.origLow = s.arRunPrice
            s.rangeLow = s.arRunPrice

    @staticmethod
    def _robust_edge(e1, e2, e3, orig, is_low):
        med = NAN
        if not na(e1) and not na(e2) and not na(e3):
            med = e1 + e2 + e3 - max(e1, e2, e3) - min(e1, e2, e3)
        elif not na(e1) and not na(e2):
            med = ((e1 + e2) / 2.0 + orig) / 2.0
        elif not na(e1):
            med = (e1 + orig) / 2.0
        if na(med):
            return orig
        return max(orig, med) if is_low else min(orig, med)

    def _register_st(self, s, price, pb, e, sp, score):
        s.stCount += 1
        s.stN += 1
        s.stEffSum += e
        s.stSprSum += sp
        s.lastGoodEff = e
        s.lastGoodSpr = sp
        s.stBar = pb
        s.stPrice = price
        s.edge3 = s.edge2
        s.edge2 = s.edge1
        s.edge1 = price
        if s.stopSide == DIR_ACCUM:
            s.rangeLow = self._robust_edge(s.edge1, s.edge2, s.edge3, s.origLow, True)
        else:
            s.rangeHigh = self._robust_edge(s.edge1, s.edge2, s.edge3, s.origHigh, False)
        s.cfST = True
        self._set_event(s, EV_ST)

    def _register_opp(self, s, price, pb, e, sp):
        s.oppCount += 1
        s.opN += 1
        s.opEffSum += e
        s.opSprSum += sp
        s.opLastBar = pb
        s.opLastPrice = price
        s.lastActBar = self.i

    @staticmethod
    def _clear_terminal(s):
        s.exc = False
        s.excTested = False
        s.excBar = NAN
        s.excPrice = NAN
        s.excEff = NAN
        s.excSpr = NAN
        s.excScore = 0
        s.testBar = NAN
        s.testPrice = NAN
        s.testScore = 0
        s.cfExc = False
        s.cfTest = False
        s.cReadyBar = NAN

    def _exc_from_pend(self, s, score):
        s.exc = True
        s.excTested = False
        s.excBar = s.pendExtBar
        s.excPrice = s.pendExt
        s.excEff = s.pendEff
        s.excSpr = s.pendSpr
        s.excScore = score
        s.cfExc = True
        s.outcome = s.pendEdge
        s.phase = PHASE_C
        s.cReadyBar = NAN
        s.pend = False
        s.provEdge = 0
        self._set_event(s, EV_SPRING if s.outcome == DIR_ACCUM else EV_UTAD)

    @staticmethod
    def _adopt_prov(s):
        s.exc = True
        s.excTested = False
        s.excBar = s.provBar
        s.excPrice = s.provPrice
        s.excEff = s.provEff
        s.excSpr = s.provSpr
        s.excScore = s.provScore
        s.cfExc = True
        s.outcome = s.provEdge
        s.provEdge = 0

    def _enter_ctest(self, s, outc, piv_bar, price, score):
        s.phase = PHASE_C
        s.outcome = outc
        s.cReadyBar = self.i
        s.testBar = piv_bar
        s.testPrice = price
        s.testScore = score
        s.cfTest = True
        s.pend = False
        self._set_event(s, EV_CTEST_ACC if outc == DIR_ACCUM else EV_CTEST_DST)

    def _promote_d(self, s, outc, score, price):
        s.outcome = outc
        s.phase = PHASE_D
        s.dStartBar = self.i
        s.strBar = self.i
        s.strPrice = price
        s.strScore = score
        s.cfStrength = True
        s.pend = False
        s.outCount = 0
        self._set_event(s, EV_SOS if outc == DIR_ACCUM else EV_SOW)

    def _demote_to_b(self, s):
        self._clear_terminal(s)
        s.outcome = DIR_NONE
        s.phase = PHASE_B
        s.strBar = NAN
        s.strPrice = NAN
        s.strScore = 0
        s.lpsPrice = NAN
        s.lpsBar = NAN
        s.lpsScore = 0
        s.dStartBar = NAN
        s.cfStrength = False
        s.cfLPS = False
        s.provEdge = 0
        s.pend = False
        s.outCount = 0
        s.lastBadBar = self.i
        s.lastActBar = self.i

    @staticmethod
    def _conf(s):
        c_done = s.cfTest or (s.cfExc and s.cfStrength)
        return ((10 if s.cfPrior else 0) + (15 if s.cfClimax else 0) + (10 if s.cfAR else 0)
                + (15 if s.cfST else 0) + (15 if c_done else 0) + (15 if s.cfStrength else 0)
                + (10 if s.cfLPS else 0) + (10 if s.cfAccept else 0))

    @staticmethod
    def _cause_units(trav, b_age, p, range_atr):
        time_units = b_age / max(p * 6.0, 1.0)
        width_bonus = 0.5 if range_atr >= PHASE_B_RANGE_MIN_ATR else 0.0
        return time_units + trav * 0.5 + width_bonus

    @staticmethod
    def _validation_score(trend, absorbed, range_atr, st, opp, trav, clean, cause, terminal, strength, lps):
        v = 0
        v += 10 if abs(trend) >= PRIOR_TREND_STRONG else (5 if abs(trend) >= PRIOR_TREND_NEUTRAL else 0)
        v += 15 if absorbed else 0
        if PHASE_B_RANGE_MIN_ATR <= range_atr <= PHASE_B_RANGE_MAX_ATR:
            v += 10
        elif PHASE_B_RANGE_MIN_ATR * 0.75 <= range_atr <= PHASE_B_RANGE_MAX_ATR * 1.5:
            v += 5
        v += 15 if st >= MIN_PHASE_B_TESTS else (8 if st >= 1 else 0)
        v += 15 if (opp >= 1 and trav >= 2) else (8 if (opp >= 1 or trav >= 1) else 0)
        v += 10 if clean else 0
        v += 10 if cause >= 3.0 else (5 if cause >= 1.5 else 0)
        v += 10 if terminal else 0
        v += 3 if strength else 0
        v += 2 if lps else 0
        return min(v, 100)

    def _validation(self, s, p, trend_now, atr_now):
        if s.stopSide == DIR_NONE:
            return 0
        i = self.i
        r_atr = self._range_atr(s, atr_now)
        b_age = max(i - s.bStartBar, 0) if not na(s.bStartBar) else 0
        bad_age = -1 if na(s.lastBadBar) else i - s.lastBadBar
        clean = bad_age < 0 or bad_age >= pround(p * PHASE_B_BAD_TEST_COOLDOWN_FACTOR)
        cause = self._cause_units(s.travCount, b_age, p, r_atr)
        terminal = (s.cfTest and (not s.exc or s.excTested)) or (s.cfExc and s.cfStrength)
        return self._validation_score(nz(s.birthTrend, trend_now), s.absorbed, r_atr, s.stCount, s.oppCount,
                                      s.travCount, clean, cause, terminal, s.cfStrength, s.cfLPS)

    @staticmethod
    def _phase_b_min_bars(p, range_atr):
        p = max(p, 1)
        raw = pround(max(float(p * 6), range_atr * p * 1.00))
        return max(MIN_PHASE_B_BARS, min(raw, MIN_PHASE_B_BARS * 2))

    @staticmethod
    def _character_improving(n, eff_sum, spr_sum, last_e, last_s):
        if n >= 2 and not na(last_e) and not na(last_s):
            avg_e = eff_sum / n
            avg_s = spr_sum / n
            return last_e <= avg_e and last_s <= avg_s * 1.05
        return False

    def _mature(self, s, p, atr_now):
        i = self.i
        r_atr = self._range_atr(s, atr_now)
        b_age = i - s.bStartBar if not na(s.bStartBar) else 0
        b_min = self._phase_b_min_bars(p, r_atr)
        bad_age = -1 if na(s.lastBadBar) else i - s.lastBadBar
        clean = bad_age < 0 or bad_age >= pround(p * PHASE_B_BAD_TEST_COOLDOWN_FACTOR)
        opp = MIN_PHASE_B_OPPOSITE_TESTS <= 0 or s.oppCount >= MIN_PHASE_B_OPPOSITE_TESTS
        trav = MIN_PHASE_B_TRAVERSALS <= 0 or s.travCount >= MIN_PHASE_B_TRAVERSALS
        ch = self._character_improving(s.stN, s.stEffSum, s.stSprSum, s.lastGoodEff, s.lastGoodSpr)
        support = int(opp) + int(trav) + int(clean) + int(ch)
        sane = PHASE_B_RANGE_MIN_ATR * 0.75 <= r_atr <= PHASE_B_RANGE_MAX_ATR * 2.0
        return s.phase == PHASE_B and b_age >= b_min and s.stCount >= MIN_PHASE_B_TESTS and sane and support >= 2

    @staticmethod
    def _test_class(near, holds, close_ok, e, sp, c_e, c_s):
        if not near:
            return TEST_NONE
        if not holds:
            return TEST_FAILED
        if close_ok and e <= c_e * ST_MAX_VOL_RATIO and sp <= c_s * ST_MAX_SPREAD_RATIO:
            return TEST_GOOD
        return TEST_POOR

    @staticmethod
    def _phase_a_min_bars(p):
        return max(PHASE_A_MIN_BARS, max(p, 1) * 2)

    @staticmethod
    def _phase_idle_limit(phase, has_ar, p):
        p = max(p, 1)
        if phase == PHASE_A:
            return max(PHASE_A_AFTER_AR_MAX_BARS, p * 6) if has_ar else max(MAX_AR_BARS, p * 4)
        if phase == PHASE_B:
            return max(PHASE_B_IDLE_MAX_BARS, p * 20)
        if phase == PHASE_C:
            return max(PHASE_C_IDLE_MAX_BARS, p * 8)
        if phase == PHASE_D:
            return max(PHASE_C_IDLE_MAX_BARS * 2, p * 16)
        return NAN

    @staticmethod
    def _exc_recovery_limit(p):
        return max(EXCURSION_RECOVERY_BARS, pround(max(p, 1) * 0.75))

    def _entry_readiness(self, s, min_conf, val_floor, atr_now, close):
        i = self.i
        bull = s.outcome == DIR_ACCUM
        if na(s.rangeHigh) or na(s.rangeLow):
            dist_atr = 99.0
        elif bull:
            dist_atr = (close - s.rangeHigh) / max(atr_now, self.mt)
        else:
            dist_atr = (s.rangeLow - close) / max(atr_now, self.mt)
        age_bars = (i - s.lastEventBar) if not na(s.lastEventBar) else 999.0
        terminal = (s.exc and s.excTested) or (not s.exc and s.cfTest)
        conf = self._conf(s)
        val = self._validation(s, int(nz(s.pivLen, PIVOT_LEN)), s.birthTrend, atr_now)
        r = 0
        r += 1 if s.outcome != DIR_NONE else 0
        r += 1 if s.phase >= PHASE_C else 0
        r += 1 if terminal else 0
        r += 1 if s.cfStrength else 0
        r += 1 if s.cfLPS else 0
        r += 1 if conf >= min_conf else 0
        r += 1 if val >= val_floor else 0
        r += 1 if dist_atr <= 2.0 else 0
        r += 1 if age_bars <= 50.0 else 0
        return r

    # ------------------------------------------------------------------ vòng lặp chính
    def run(self, df: pd.DataFrame) -> pd.DataFrame:
        """df cần cột open/high/low/close/volume. Trả về DataFrame cùng index với các cột wy_*."""
        self._prepare(df)
        n = self.D.n
        self.s = WS()
        self.regime = REGIME_NONE
        self.regime_bar = NAN
        self.last_pl_bar = NAN
        self.last_ph_bar = NAN
        self.rs_counts = [0] * 7
        self.last_reset_why = -1

        cols = {k: np.zeros(n) for k in (
            "wy_stop", "wy_outcome", "wy_wdir", "wy_phase", "wy_event", "wy_conf", "wy_val",
            "wy_entry", "wy_entry_kind", "wy_sig", "wy_trend")}
        cols["wy_range_hi"] = np.full(n, np.nan)
        cols["wy_range_lo"] = np.full(n, np.nan)

        for i in range(n):
            sig, trend_score = self._step(i)
            s = self.s
            cols["wy_stop"][i] = s.stopSide
            cols["wy_outcome"][i] = s.outcome
            cols["wy_wdir"][i] = s.outcome if s.outcome != DIR_NONE else self._bias_dir(s)
            cols["wy_phase"][i] = s.phase
            cols["wy_event"][i] = s.ev
            cols["wy_conf"][i] = self._conf(s) if s.stopSide != DIR_NONE else 0
            cols["wy_val"][i] = self._validation(s, int(nz(s.pivLen, self.D.live_len[i])), trend_score,
                                                  self.D.a[i])
            cols["wy_range_hi"][i] = s.rangeHigh
            cols["wy_range_lo"][i] = s.rangeLow
            cols["wy_sig"][i] = sig
            cols["wy_trend"][i] = trend_score
            if not na(s.entryBar) and int(s.entryBar) == i and s.entryKind != ENTRY_NONE:
                cols["wy_entry"][i] = s.outcome          # +1 long (accumulation) / -1 short (distribution)
                cols["wy_entry_kind"][i] = s.entryKind

        out = pd.DataFrame(cols, index=df.index)
        for k in ("wy_stop", "wy_outcome", "wy_wdir", "wy_phase", "wy_event", "wy_conf", "wy_val",
                  "wy_entry", "wy_entry_kind", "wy_sig"):
            out[k] = out[k].astype(int)
        return out

    # ------------------------------------------------------------------ một nến
    def _step(self, i):
        D = self.D
        mt = self.mt
        self.i = i
        s = self.s

        o = D.o[i]; h = D.h[i]; l = D.l[i]; c = D.c[i]
        eff = D.eff[i]; spr = D.spr[i]; avg_eff = D.avg_eff[i]; avg_eff_prev = D.avg_eff_prev[i]
        a = D.a[i]; a_prev = D.a_prev[i]; c_pos = D.c_pos[i]; rel_e = D.rel_e[i]; spr_atr = D.spr_atr[i]
        live_len = D.live_len[i]
        pre_len = D.pre_len[i]
        close1 = D.c1[i]
        close2 = D.c2[i]

        # ---- pivot (độ dài phụ thuộc state tại đầu nến)
        p_len = int(nz(s.pivLen, live_len)) if s.phase != PHASE_NONE else live_len
        ph = pl = NAN
        if i - 2 * p_len >= 0:
            j0 = i - p_len
            if D.h[j0] >= D.h_np[i - 2 * p_len:i + 1].max():
                ph = D.h[j0]
            if D.l[j0] <= D.l_np[i - 2 * p_len:i + 1].min():
                pl = D.l[j0]
        self.ph_arr[i] = ph
        self.pl_arr[i] = pl
        piv_bar = i - p_len
        jb = piv_bar

        def at(arr, idx, default):
            if idx >= 0:
                v = arr[idx]
                return default if v != v else v
            return default

        pA = max(at(D.atr_raw, jb, a), mt)
        pEff = at(D.eff, jb, eff)
        pSpr = max(at(D.h, jb, h) - at(D.l, jb, l), mt)
        pCPos = (at(D.c, jb, c) - at(D.l, jb, l)) / pSpr
        pAvgEff = at(D.avg_eff_raw, jb, avg_eff)

        # ---- trend
        trend_bars = max(TREND_LEN, min(PRIOR_TREND_MAX_BARS, pround(live_len * PRIOR_TREND_PIVOT_FACTOR)))
        trend_end = max(2, min(8, pround(live_len * 0.75)))
        trend_score = self._prior_trend(i, trend_bars, trend_end)
        down_trend = trend_score <= -PRIOR_TREND_NEUTRAL
        up_trend = trend_score >= PRIOR_TREND_NEUTRAL
        strong_trend = abs(trend_score) >= PRIOR_TREND_STRONG

        def nzat(arr, idx):
            if idx >= 0:
                v = arr[idx]
                return 0.0 if v != v else v
            return 0.0

        ls1 = nzat(D.long_sma, i - 1)
        ls20 = nzat(D.long_sma, i - 20)
        c_prev1 = nzat(D.c, i - 1)
        long_bull = c_prev1 > ls1 and ls1 > ls20
        ls20_raw = D.long_sma[i - 20] if i - 20 >= 0 else NAN
        long_bear = (not na(ls20_raw)) and c_prev1 < ls1 and ls1 < ls20

        hi_c_inv = D.hi_c_inv[i]; lo_c_inv = D.lo_c_inv[i]
        hi_c_dep = D.hi_c_dep[i]; lo_c_dep = D.lo_c_dep[i]
        hi_c_a = D.hi_c_a[i]; lo_c_a = D.lo_c_a[i]
        hi_c_conf = D.hi_c_conf[i]; lo_c_conf = D.lo_c_conf[i]
        hi_c_dir = D.hi_c_dir[i]; lo_c_dir = D.lo_c_dir[i]
        hi_c_fail = D.hi_c_fail[i]; lo_c_fail = D.lo_c_fail[i]
        mb_sos = D.mb_sos[i]; mb_sow = D.mb_sow[i]
        res3_up = D.res3_up[i]; res3_dn = D.res3_dn[i]
        sos_score = D.sos_score[i]; sow_score = D.sow_score[i]
        ctx_bars = max(PRIOR_TREND_MAX_BARS, CONTINUATION_TREND_LEN) * 2
        sig = 0

        # =========================== COMMIT BLOCK ===========================
        p0 = int(nz(s.pivLen, live_len))
        rk0 = not na(s.rangeHigh) and not na(s.rangeLow)
        r_h0 = s.rangeHigh
        r_l0 = s.rangeLow
        r_ht0 = max(r_h0 - r_l0, mt) if rk0 else NAN
        r_mid0 = (r_h0 + r_l0) / 2.0 if rk0 else NAN
        probe_open = s.pend and i - s.pendStartBar <= self._exc_recovery_limit(p0)
        struct_age = i - s.startBar if not na(s.startBar) else 0
        age_ok_bull = self.regime != REGIME_MARKDOWN or struct_age >= OPPOSITE_CYCLE_MIN_BARS
        age_ok_bear = self.regime != REGIME_MARKUP or struct_age >= OPPOSITE_CYCLE_MIN_BARS
        hard_bull0 = self._hard_level(s, DIR_ACCUM)
        hard_bear0 = self._hard_level(s, DIR_DIST)
        reset_why = -1

        # ---- retire
        if s.phase == PHASE_A:
            a_age = i - s.climaxBar
            a_inv_acc = s.stopSide == DIR_ACCUM and hi_c_inv < s.climaxPrice - a * STRUCTURE_INVALIDATION_ATR
            a_inv_dst = s.stopSide == DIR_DIST and lo_c_inv > s.climaxPrice + a * STRUCTURE_INVALIDATION_ATR
            a_abs_exp = (not s.absorbed) and a_age > CLIMAX_ABSORPTION_MAX_BARS
            a_no_ar = (not s.arOK) and a_age > MAX_AR_BARS
            a_over = (s.arOK and not na(s.arRunPrice)
                      and abs(s.arRunPrice - s.climaxPrice) / max(nz(s.climaxATR, a), mt) > AR_MAX_EXTENSION_ATR)
            a_buf = max(r_ht0 * PHASE_A_PREMATURE_DEPARTURE_TR_FRAC, a * PHASE_A_PREMATURE_DEPARTURE_ATR) if rk0 else NAN
            a_depart = (a_age > MAX_AR_BARS and rk0 and
                        ((s.stopSide == DIR_ACCUM and lo_c_a > r_h0 + a_buf) or
                         (s.stopSide == DIR_DIST and hi_c_a < r_l0 - a_buf)))
            if a_inv_acc or a_inv_dst:
                reset_why = RS_INVALID
            elif a_abs_exp:
                reset_why = RS_ABSORB
            elif a_no_ar or a_over or a_depart:
                reset_why = RS_NORANGE

        if s.phase == PHASE_C and not probe_open and reset_why < 0:
            c_bull_dead = (s.outcome == DIR_ACCUM and not na(hard_bull0)
                           and hi_c_inv < hard_bull0 - a * STRUCTURE_INVALIDATION_ATR)
            c_bear_dead = (s.outcome == DIR_DIST and not na(hard_bear0)
                           and lo_c_inv > hard_bear0 + a * STRUCTURE_INVALIDATION_ATR)
            if c_bull_dead or c_bear_dead:
                reset_why = RS_INVALID

        if s.phase == PHASE_D and rk0 and reset_why < 0:
            if s.outcome == DIR_ACCUM:
                if not na(hard_bull0) and hi_c_inv < hard_bull0 - a * STRUCTURE_INVALIDATION_ATR:
                    reset_why = RS_INVALID
                elif hi_c_fail < r_mid0:
                    self._demote_to_b(s)
                    self.rs_counts[RS_DEMOTE] += 1
            elif s.outcome == DIR_DIST:
                if not na(hard_bear0) and lo_c_inv > hard_bear0 + a * STRUCTURE_INVALIDATION_ATR:
                    reset_why = RS_INVALID
                elif lo_c_fail > r_mid0:
                    self._demote_to_b(s)
                    self.rs_counts[RS_DEMOTE] += 1

        if s.phase == PHASE_E and rk0 and reset_why < 0:
            e_fail = (hi_c_fail < r_mid0) if s.outcome == DIR_ACCUM else (lo_c_fail > r_mid0)
            e_old = PHASE_E_MAX_BARS > 0 and not na(s.eStartBar) and i - s.eStartBar > PHASE_E_MAX_BARS
            if e_fail or e_old:
                reset_why = RS_EEND

        idle_lim = self._phase_idle_limit(s.phase, s.arOK, p0)
        if (reset_why < 0 and not probe_open and not na(idle_lim) and not na(s.lastActBar)
                and i - s.lastActBar > idle_lim):
            reset_why = RS_STALE

        if reset_why >= 0:
            self.rs_counts[reset_why] += 1
            self.last_reset_why = reset_why
            s = self.s = WS()

        # ---- seed climax mới
        relax_k = RELAXED_CLIMAX_FACTOR if strong_trend else 1.0
        vol_hit = eff >= avg_eff_prev * CLIMAX_VOL_MULT * relax_k
        spr_hit = spr >= a_prev * CLIMAX_SPREAD_MULT * relax_k
        eh = D.eff_hi_prior[i]
        exceptional = ((not na(eh)) and eff >= eh) or spr >= a_prev * CLIMAX_SPREAD_MULT * 1.5
        new_low = D.new_low[i]
        new_high = D.new_high[i]
        sc_sc = (int(down_trend) + int(new_low) + int(vol_hit) + int(spr_hit)
                 + int(c_pos >= SC_CLOSE_MIN) + int(exceptional))
        bc_sc = (int(up_trend) + int(new_high) + int(vol_hit) + int(spr_hit)
                 + int(c_pos <= BC_CLOSE_MAX) + int(exceptional))
        seed_open = s.phase == PHASE_NONE or s.phase == PHASE_E
        can_sc = seed_open or (s.phase == PHASE_A and s.stopSide == DIR_ACCUM and l < s.climaxPrice)
        can_bc = seed_open or (s.phase == PHASE_A and s.stopSide == DIR_DIST and h > s.climaxPrice)
        is_sc = can_sc and down_trend and new_low and vol_hit and spr_hit and sc_sc >= CLIMAX_MIN_SCORE
        is_bc = can_bc and up_trend and new_high and vol_hit and spr_hit and bc_sc >= CLIMAX_MIN_SCORE
        if is_sc != is_bc:
            seed_side = DIR_ACCUM if is_sc else DIR_DIST
            recent_markup = (self.regime == REGIME_MARKUP and not na(self.regime_bar)
                             and i - self.regime_bar <= ctx_bars)
            recent_markdown = (self.regime == REGIME_MARKDOWN and not na(self.regime_bar)
                               and i - self.regime_bar <= ctx_bars)
            s = self.s = WS()
            self._seed(s, seed_side, pre_len, trend_score, recent_markup or long_bull,
                       recent_markdown or long_bear, a, eff, spr, l, h)

        # ---- xác nhận stopping action (absorption) + AR
        if s.phase == PHASE_A and not s.absorbed and not na(s.climaxBar):
            abs_age = i - s.climaxBar
            if CLIMAX_ABSORPTION_MIN_BARS <= abs_age <= CLIMAX_ABSORPTION_MAX_BARS:
                effort_ok = D.recent_eff[i] >= avg_eff * CLIMAX_ABSORPTION_VOL_FLOOR
                acc_abs = (s.stopSide == DIR_ACCUM
                           and D.recent_low[i] >= s.climaxPrice - s.climaxATR * CLIMAX_ABSORPTION_EXTREME_ATR
                           and c >= s.climaxPrice + s.climaxATR * CLIMAX_ABSORPTION_REBOUND_ATR)
                dst_abs = (s.stopSide == DIR_DIST
                           and D.recent_high[i] <= s.climaxPrice + s.climaxATR * CLIMAX_ABSORPTION_EXTREME_ATR
                           and c <= s.climaxPrice - s.climaxATR * CLIMAX_ABSORPTION_REBOUND_ATR)
                if effort_ok and (acc_abs or dst_abs):
                    s.absorbed = True
                    s.cfClimax = True
                    s.lastActBar = i
                    sig |= BIT_SC if s.stopSide == DIR_ACCUM else BIT_BC

        if (s.phase == PHASE_A and na(s.arBar) and not na(s.climaxBar) and i > s.climaxBar
                and i - s.climaxBar <= MAX_AR_BARS):
            if s.stopSide == DIR_ACCUM:
                if na(s.arRunPrice) or h > s.arRunPrice:
                    s.arRunPrice = h
                    s.arRunBar = i
                s.arOK = s.arOK or (s.arRunPrice - s.climaxPrice >= a * MIN_AR_ATR)
            else:
                if na(s.arRunPrice) or l < s.arRunPrice:
                    s.arRunPrice = l
                    s.arRunBar = i
                s.arOK = s.arOK or (s.climaxPrice - s.arRunPrice >= a * MIN_AR_ATR)
        if s.phase == PHASE_A and s.arOK and s.absorbed and na(s.arBar):
            if s.stopSide == DIR_ACCUM:
                s.rangeHigh = s.arRunPrice
                s.origHigh = s.arRunPrice
            else:
                s.rangeLow = s.arRunPrice
                s.origLow = s.arRunPrice

        # ---- pivot-driven events
        p1 = int(nz(s.pivLen, live_len))
        rk1 = not na(s.rangeHigh) and not na(s.rangeLow)
        r_h1 = s.rangeHigh
        r_l1 = s.rangeLow
        orig_ht1 = max(nz(s.origHigh, r_h1) - nz(s.origLow, r_l1), mt) if rk1 else NAN
        mature1 = self._mature(s, p1, a)
        new_pl = (not na(pl)) and (na(self.last_pl_bar) or piv_bar > self.last_pl_bar)
        new_ph = (not na(ph)) and (na(self.last_ph_bar) or piv_bar > self.last_ph_bar)
        if new_pl:
            self.last_pl_bar = piv_bar
        if new_ph:
            self.last_ph_bar = piv_bar
        pl_used = False
        ph_used = False

        # Terminal test (C-Test) từ Phase B trưởng thành
        if new_pl and s.phase == PHASE_B and mature1 and rk1:
            lo_ref_st = s.stopSide == DIR_ACCUM
            t_ref_n = s.stN if lo_ref_st else s.opN
            t_ref_bar = s.stBar if lo_ref_st else s.opLastBar
            t_ref_price = s.stPrice if lo_ref_st else s.opLastPrice
            if t_ref_n > 0 and not na(t_ref_bar):
                t_ref_eff = (s.stEffSum if lo_ref_st else s.opEffSum) / t_ref_n
                t_ref_spr = (s.stSprSum if lo_ref_st else s.opSprSum) / t_ref_n
                t_later = piv_bar >= t_ref_bar + TERMINAL_TEST_MIN_BARS_AFTER_ST
                t_near = pl <= r_l1 + pA * TEST_TOL_ATR
                t_holds = pl >= min(nz(s.origLow, r_l1), r_l1) - pA * TEST_EXTREME_TOLERANCE_ATR
                t_higher = na(t_ref_price) or pl >= t_ref_price - pA * TEST_EXTREME_TOLERANCE_ATR
                tq_v = pEff <= t_ref_eff * TERMINAL_TEST_VOL_RATIO
                tq_s = pSpr <= t_ref_spr * TERMINAL_TEST_SPREAD_RATIO
                tn_v = pEff <= t_ref_eff * TERMINAL_TEST_OTHER_MAX_RATIO
                tn_s = pSpr <= t_ref_spr * TERMINAL_TEST_OTHER_MAX_RATIO
                t_sc = int(tq_v) + int(tq_s) + int(pCPos >= 0.50)
                if t_later and t_near and t_holds and t_higher and ((tq_v and tn_s) or (tq_s and tn_v)) and t_sc >= TEST_MIN_SCORE:
                    self._enter_ctest(s, DIR_ACCUM, piv_bar, pl, t_sc)
                    sig |= BIT_CTEST
                    pl_used = True
        if new_ph and s.phase == PHASE_B and mature1 and rk1:
            hi_ref_st = s.stopSide == DIR_DIST
            u_ref_n = s.stN if hi_ref_st else s.opN
            u_ref_bar = s.stBar if hi_ref_st else s.opLastBar
            u_ref_price = s.stPrice if hi_ref_st else s.opLastPrice
            if u_ref_n > 0 and not na(u_ref_bar):
                u_ref_eff = (s.stEffSum if hi_ref_st else s.opEffSum) / u_ref_n
                u_ref_spr = (s.stSprSum if hi_ref_st else s.opSprSum) / u_ref_n
                u_later = piv_bar >= u_ref_bar + TERMINAL_TEST_MIN_BARS_AFTER_ST
                u_near = ph >= r_h1 - pA * TEST_TOL_ATR
                u_holds = ph <= max(nz(s.origHigh, r_h1), r_h1) + pA * TEST_EXTREME_TOLERANCE_ATR
                u_lower = na(u_ref_price) or ph <= u_ref_price + pA * TEST_EXTREME_TOLERANCE_ATR
                uq_v = pEff <= u_ref_eff * TERMINAL_TEST_VOL_RATIO
                uq_s = pSpr <= u_ref_spr * TERMINAL_TEST_SPREAD_RATIO
                un_v = pEff <= u_ref_eff * TERMINAL_TEST_OTHER_MAX_RATIO
                un_s = pSpr <= u_ref_spr * TERMINAL_TEST_OTHER_MAX_RATIO
                u_sc = int(uq_v) + int(uq_s) + int(pCPos <= 0.50)
                if u_later and u_near and u_holds and u_lower and ((uq_v and un_s) or (uq_s and un_v)) and u_sc >= TEST_MIN_SCORE:
                    self._enter_ctest(s, DIR_DIST, piv_bar, ph, u_sc)
                    sig |= BIT_CTEST
                    ph_used = True

        # Phase A: ST đầu tiên -> Phase B
        if (new_pl and not pl_used and s.phase == PHASE_A and s.stopSide == DIR_ACCUM and s.absorbed
                and s.arOK and not na(s.arRunBar) and piv_bar > s.arRunBar):
            zone_top = s.origLow + (s.arRunPrice - s.origLow) * PHASE_B_ZONE_FRAC
            near_l = abs(pl - s.origLow) <= pA * BOUNDARY_TOL_ATR or pl <= zone_top
            holds_l = pl >= s.origLow - pA * BOUNDARY_TOL_ATR
            close_l = pCPos >= 0.45
            tc = self._test_class(near_l, holds_l, close_l, pEff, pSpr, s.climaxEff, s.climaxSpr)
            sc_l = (int(near_l) + int(pEff <= s.climaxEff * ST_MAX_VOL_RATIO) + int(pSpr <= s.climaxSpr * ST_MAX_SPREAD_RATIO)
                    + int(holds_l) + int(close_l) + 1)
            age_l = piv_bar - s.startBar >= self._phase_a_min_bars(p1)
            space_l = piv_bar - s.arRunBar >= max(2, p1)
            if near_l:
                s.lastActBar = i
            if tc == TEST_GOOD and sc_l >= ST_MIN_SCORE and age_l and space_l:
                self._freeze_ar(s)
                self._register_st(s, pl, piv_bar, pEff, pSpr, sc_l)
                s.phase = PHASE_B
                s.bStartBar = piv_bar
                sig |= BIT_AR | BIT_ST
                pl_used = True
        if (new_ph and not ph_used and s.phase == PHASE_A and s.stopSide == DIR_DIST and s.absorbed
                and s.arOK and not na(s.arRunBar) and piv_bar > s.arRunBar):
            zone_bot = s.origHigh - (s.origHigh - s.arRunPrice) * PHASE_B_ZONE_FRAC
            near_h = abs(ph - s.origHigh) <= pA * BOUNDARY_TOL_ATR or ph >= zone_bot
            holds_h = ph <= s.origHigh + pA * BOUNDARY_TOL_ATR
            close_h = pCPos <= 0.55
            tc = self._test_class(near_h, holds_h, close_h, pEff, pSpr, s.climaxEff, s.climaxSpr)
            sc_h = (int(near_h) + int(pEff <= s.climaxEff * ST_MAX_VOL_RATIO) + int(pSpr <= s.climaxSpr * ST_MAX_SPREAD_RATIO)
                    + int(holds_h) + int(close_h) + 1)
            age_h = piv_bar - s.startBar >= self._phase_a_min_bars(p1)
            space_h = piv_bar - s.arRunBar >= max(2, p1)
            if near_h:
                s.lastActBar = i
            if tc == TEST_GOOD and sc_h >= ST_MIN_SCORE and age_h and space_h:
                self._freeze_ar(s)
                self._register_st(s, ph, piv_bar, pEff, pSpr, sc_h)
                s.phase = PHASE_B
                s.bStartBar = piv_bar
                sig |= BIT_AR | BIT_ST
                ph_used = True

        # Phase B: ST thêm + opposite-edge
        rk1 = not na(s.rangeHigh) and not na(s.rangeLow)
        if new_pl and not pl_used and s.phase == PHASE_B and rk1 and piv_bar > s.bStartBar:
            b_ht = max(s.rangeHigh - s.rangeLow, mt)
            if s.stopSide == DIR_ACCUM:
                b_near = (abs(pl - s.rangeLow) <= pA * BOUNDARY_TOL_ATR or abs(pl - s.origLow) <= pA * BOUNDARY_TOL_ATR
                          or pl <= s.rangeLow + b_ht * PHASE_B_ZONE_FRAC)
                b_holds = pl >= s.origLow - pA * BOUNDARY_TOL_ATR
                b_close = pCPos >= 0.45
                b_tc = self._test_class(b_near, b_holds, b_close, pEff, pSpr, s.climaxEff, s.climaxSpr)
                b_sc = (int(b_near) + int(pEff <= s.climaxEff * ST_MAX_VOL_RATIO)
                        + int(pSpr <= s.climaxSpr * ST_MAX_SPREAD_RATIO) + int(b_holds) + int(b_close) + 1)
                b_is_prov = s.provEdge == DIR_ACCUM and not na(s.provBar) and abs(piv_bar - s.provBar) <= p1
                if b_near:
                    s.lastActBar = i
                if b_tc == TEST_FAILED and not b_is_prov:
                    s.lastBadBar = piv_bar
                elif b_tc == TEST_GOOD and b_sc >= ST_MIN_SCORE:
                    self._register_st(s, pl, piv_bar, pEff, pSpr, b_sc)
                    sig |= BIT_ST
            else:
                if pl < s.rangeLow and pl >= nz(s.origLow, s.rangeLow) - orig_ht1 * PHASE_B_EDGE_EXPANSION_CAP:
                    s.rangeLow = pl
                o_ht_l = max(s.rangeHigh - s.rangeLow, mt)
                o_near_l = pl <= s.rangeLow + pA * BOUNDARY_TOL_ATR or pl <= s.rangeLow + o_ht_l * PHASE_B_ZONE_FRAC
                o_inside_l = pl >= nz(s.origLow, s.rangeLow) - orig_ht1 * PHASE_B_EDGE_EXPANSION_CAP
                o_ctrl_l = pEff <= s.climaxEff * 1.20 and pSpr <= s.climaxSpr * 1.20
                if o_near_l and o_inside_l and o_ctrl_l and (na(s.opLastBar) or piv_bar > s.opLastBar):
                    self._register_opp(s, pl, piv_bar, pEff, pSpr)
        if new_ph and not ph_used and s.phase == PHASE_B and rk1 and piv_bar > s.bStartBar:
            b_ht_h = max(s.rangeHigh - s.rangeLow, mt)
            if s.stopSide == DIR_DIST:
                h_near = (abs(ph - s.rangeHigh) <= pA * BOUNDARY_TOL_ATR or abs(ph - s.origHigh) <= pA * BOUNDARY_TOL_ATR
                          or ph >= s.rangeHigh - b_ht_h * PHASE_B_ZONE_FRAC)
                h_holds = ph <= s.origHigh + pA * BOUNDARY_TOL_ATR
                h_close = pCPos <= 0.55
                h_tc = self._test_class(h_near, h_holds, h_close, pEff, pSpr, s.climaxEff, s.climaxSpr)
                h_sc = (int(h_near) + int(pEff <= s.climaxEff * ST_MAX_VOL_RATIO)
                        + int(pSpr <= s.climaxSpr * ST_MAX_SPREAD_RATIO) + int(h_holds) + int(h_close) + 1)
                h_is_prov = s.provEdge == DIR_DIST and not na(s.provBar) and abs(piv_bar - s.provBar) <= p1
                if h_near:
                    s.lastActBar = i
                if h_tc == TEST_FAILED and not h_is_prov:
                    s.lastBadBar = piv_bar
                elif h_tc == TEST_GOOD and h_sc >= ST_MIN_SCORE:
                    self._register_st(s, ph, piv_bar, pEff, pSpr, h_sc)
                    sig |= BIT_ST
            else:
                if ph > s.rangeHigh and ph <= nz(s.origHigh, s.rangeHigh) + orig_ht1 * PHASE_B_EDGE_EXPANSION_CAP:
                    s.rangeHigh = ph
                o_ht_h = max(s.rangeHigh - s.rangeLow, mt)
                o_near_h = ph >= s.rangeHigh - pA * BOUNDARY_TOL_ATR or ph >= s.rangeHigh - o_ht_h * PHASE_B_ZONE_FRAC
                o_inside_h = ph <= nz(s.origHigh, s.rangeHigh) + orig_ht1 * PHASE_B_EDGE_EXPANSION_CAP
                o_ctrl_h = pEff <= s.climaxEff * 1.20 and pSpr <= s.climaxSpr * 1.20
                if o_near_h and o_inside_h and o_ctrl_h and (na(s.opLastBar) or piv_bar > s.opLastBar):
                    self._register_opp(s, ph, piv_bar, pEff, pSpr)

        # traversal (qua lại giữa hai biên)
        if s.phase == PHASE_B and not na(s.rangeHigh) and not na(s.rangeLow):
            tv_ht = max(s.rangeHigh - s.rangeLow, mt)
            lo_zone_p = new_pl and pl <= s.rangeLow + tv_ht * PHASE_B_ZONE_FRAC
            hi_zone_p = new_ph and ph >= s.rangeHigh - tv_ht * PHASE_B_ZONE_FRAC
            zone_now = (-1 if lo_zone_p else 1) if (lo_zone_p != hi_zone_p) else 0
            if zone_now != 0 and (na(s.lastZoneBar) or piv_bar > s.lastZoneBar):
                if s.lastZone != 0 and zone_now != s.lastZone:
                    s.travCount += 1
                    s.lastActBar = i
                s.lastZone = zone_now
                s.lastZoneBar = piv_bar

        # Test sau Spring / UTAD
        if (new_pl and s.phase == PHASE_C and s.outcome == DIR_ACCUM and s.exc and not s.excTested
                and piv_bar > s.excBar and not na(s.rangeLow)):
            x_near = pl <= s.rangeLow + pA * TEST_TOL_ATR
            x_keep = pl >= s.excPrice - pA * TEST_EXTREME_TOLERANCE_ATR
            x_sc = int(pEff <= s.excEff * TEST_MAX_VOL_RATIO) + int(pSpr <= s.excSpr * TEST_MAX_SPREAD_RATIO) + int(pCPos >= 0.50)
            if x_near and x_keep and x_sc >= TEST_MIN_SCORE:
                s.excTested = True
                s.cReadyBar = i
                s.testBar = piv_bar
                s.testPrice = pl
                s.testScore = x_sc
                s.cfTest = True
                self._set_event(s, EV_TEST)
                sig |= BIT_TEST
        if (new_ph and s.phase == PHASE_C and s.outcome == DIR_DIST and s.exc and not s.excTested
                and piv_bar > s.excBar and not na(s.rangeHigh)):
            x_near = ph >= s.rangeHigh - pA * TEST_TOL_ATR
            x_keep = ph <= s.excPrice + pA * TEST_EXTREME_TOLERANCE_ATR
            x_sc = int(pEff <= s.excEff * TEST_MAX_VOL_RATIO) + int(pSpr <= s.excSpr * TEST_MAX_SPREAD_RATIO) + int(pCPos <= 0.50)
            if x_near and x_keep and x_sc >= TEST_MIN_SCORE:
                s.excTested = True
                s.cReadyBar = i
                s.testBar = piv_bar
                s.testPrice = ph
                s.testScore = x_sc
                s.cfTest = True
                self._set_event(s, EV_TEST)
                sig |= BIT_TEST

        # LPS / LPSY trong Phase D
        if (new_pl and s.phase == PHASE_D and s.outcome == DIR_ACCUM and not na(s.strBar)
                and piv_bar > s.strBar and not na(s.rangeHigh)):
            l_hard = self._hard_level(s, DIR_ACCUM)
            l_side = (not na(l_hard)) and pl > l_hard - pA * TEST_EXTREME_TOLERANCE_ATR
            l_creek = pl >= s.rangeHigh - pA * LPS_BOUNDARY_ATR
            l_sc = int(pEff <= pAvgEff * LPS_VOL_MULT) + int(pSpr <= pA * LPS_SPREAD_ATR) + int(pCPos >= 0.45)
            if l_side and l_creek and l_sc >= LPS_MIN_SCORE:
                s.lpsPrice = pl
                s.lpsBar = i
                s.lpsScore = l_sc
                s.cfLPS = True
                self._set_event(s, EV_LPS)
                sig |= BIT_LPS
        if (new_ph and s.phase == PHASE_D and s.outcome == DIR_DIST and not na(s.strBar)
                and piv_bar > s.strBar and not na(s.rangeLow)):
            y_hard = self._hard_level(s, DIR_DIST)
            y_side = (not na(y_hard)) and ph < y_hard + pA * TEST_EXTREME_TOLERANCE_ATR
            y_ice = ph <= s.rangeLow + pA * LPS_BOUNDARY_ATR
            y_sc = int(pEff <= pAvgEff * LPS_VOL_MULT) + int(pSpr <= pA * LPS_SPREAD_ATR) + int(pCPos <= 0.55)
            if y_side and y_ice and y_sc >= LPS_MIN_SCORE:
                s.lpsPrice = ph
                s.lpsBar = i
                s.lpsScore = y_sc
                s.cfLPS = True
                self._set_event(s, EV_LPSY)
                sig |= BIT_LPSY

        # ---- Spring / UTAD / terminal tests
        p2 = int(nz(s.pivLen, live_len))
        rk2 = not na(s.rangeHigh) and not na(s.rangeLow)
        r_h2 = s.rangeHigh
        r_l2 = s.rangeLow
        rec_limit2 = self._exc_recovery_limit(p2)
        mature2 = self._mature(s, p2, a)
        b_age2 = i - s.bStartBar if not na(s.bStartBar) else 0
        probe_b = s.phase == PHASE_B and s.stCount >= 1 and b_age2 >= max(3, p2 * 2)
        probe_c_lo = s.phase == PHASE_C and s.outcome == DIR_ACCUM and not s.exc
        probe_c_hi = s.phase == PHASE_C and s.outcome == DIR_DIST and not s.exc

        if rk2 and not s.pend and (na(s.pendCoolBar) or i > s.pendCoolBar):
            pen_lo = r_l2 - l
            pen_hi = h - r_h2
            ok_lo = (probe_b or probe_c_lo) and a * SPRING_MIN_PEN_ATR <= pen_lo <= a * SPRING_MAX_PEN_ATR
            ok_hi = (probe_b or probe_c_hi) and a * SPRING_MIN_PEN_ATR <= pen_hi <= a * SPRING_MAX_PEN_ATR
            if ok_lo != ok_hi:
                s.pend = True
                s.pendEdge = DIR_ACCUM if ok_lo else DIR_DIST
                s.pendStartBar = i
                s.pendExtBar = i
                s.pendExt = l if ok_lo else h
                s.pendEff = eff
                s.pendSpr = spr

        if s.pend and rk2 and (s.phase == PHASE_B or s.phase == PHASE_C):
            if s.pendEdge == DIR_ACCUM and l < s.pendExt:
                s.pendExt = l
                s.pendExtBar = i
                s.pendEff = max(nz(s.pendEff), eff)
                s.pendSpr = max(nz(s.pendSpr), spr)
            elif s.pendEdge == DIR_DIST and h > s.pendExt:
                s.pendExt = h
                s.pendExtBar = i
                s.pendEff = max(nz(s.pendEff), eff)
                s.pendSpr = max(nz(s.pendSpr), spr)
            rec_age = i - s.pendStartBar
            recovered = (c > r_l2) if s.pendEdge == DIR_ACCUM else (c < r_h2)
            depth = (r_l2 - s.pendExt) if s.pendEdge == DIR_ACCUM else (s.pendExt - r_h2)
            depth_ok = a * SPRING_MIN_PEN_ATR <= depth <= a * SPRING_MAX_PEN_ATR
            if s.pendEdge == DIR_ACCUM:
                rec_sc = (int(c_pos >= SPRING_CLOSE_MIN) + int(eff <= avg_eff * SPRING_EFFORT_MAX_MULT)
                          + int(c > o) + int(spr >= a * 0.50))
            else:
                rec_sc = (int(c_pos <= UTAD_CLOSE_MAX) + int(eff <= avg_eff * SPRING_EFFORT_MAX_MULT)
                          + int(c < o) + int(spr >= a * 0.50))
            if recovered and depth_ok and rec_age <= rec_limit2 and rec_sc >= EXCURSION_MIN_SCORE:
                probe_edge = s.pendEdge
                if s.phase == PHASE_B and not mature2:
                    s.provEdge = probe_edge
                    s.provBar = s.pendExtBar
                    s.provPrice = s.pendExt
                    s.provEff = s.pendEff
                    s.provSpr = s.pendSpr
                    s.provScore = rec_sc
                    s.lastActBar = i
                    s.pend = False
                else:
                    if s.phase == PHASE_C:
                        self._clear_terminal(s)
                    self._exc_from_pend(s, rec_sc)
                    sig |= BIT_SPRING if probe_edge == DIR_ACCUM else BIT_UTAD
            elif rec_age > rec_limit2 or ((not depth_ok) and depth > a * SPRING_MAX_PEN_ATR):
                if s.phase == PHASE_B:
                    s.lastBadBar = i
                s.pend = False
                s.pendCoolBar = i + p2

        if s.phase == PHASE_C and s.exc and not s.excTested and rk2:
            if s.outcome == DIR_ACCUM and l < s.excPrice and l >= r_l2 - a * SPRING_MAX_PEN_ATR:
                s.excPrice = l
                s.excBar = i
                s.excEff = max(nz(s.excEff), eff)
                s.excSpr = max(nz(s.excSpr), spr)
            elif s.outcome == DIR_DIST and h > s.excPrice and h <= r_h2 + a * SPRING_MAX_PEN_ATR:
                s.excPrice = h
                s.excBar = i
                s.excEff = max(nz(s.excEff), eff)
                s.excSpr = max(nz(s.excSpr), spr)

        # ---- SOS / SOW -> Phase D
        if s.phase == PHASE_C and rk2 and not s.pend:
            c_min_d = max(PHASE_C_TO_D_MIN_BARS, int(max(p2, 1) / 2))
            c_formal = (not s.exc) or s.excTested
            c_anchor = s.cReadyBar if not na(s.cReadyBar) else s.excBar
            c_age_ready = (not na(c_anchor)) and i - c_anchor >= c_min_d
            c_val = self._validation(s, p2, trend_score, a)
            c_val_d = c_val if c_formal else min(100, c_val + 13)
            c_conf = self._conf(s)
            c_conf_d = c_conf if c_formal else min(100, c_conf + 30)
            c_ht = max(r_h2 - r_l2, mt)
            if c_age_ready and c_val_d >= PHASE_D_VALIDATION_MIN and c_conf_d >= MIN_CONFIDENCE_PHASE_C:
                if s.outcome == DIR_ACCUM and age_ok_bull:
                    dom_up = r_l2 + c_ht * PHASE_D_DOMINANCE_FRAC
                    brk_up = c > r_h2 + a * BREAK_ATR
                    if c_formal:
                        dom_ok_up = brk_up or (c >= dom_up and close1 >= dom_up)
                    else:
                        dom_ok_up = brk_up or (c >= dom_up and close1 >= dom_up and close2 >= dom_up)
                    req_up = STRENGTH_MIN_SCORE if c_formal else max(2, STRENGTH_MIN_SCORE - 1)
                    q_up = sos_score >= req_up or mb_sos or ((not c_formal) and res3_up >= 1.0)
                    if dom_ok_up and q_up:
                        self._promote_d(s, DIR_ACCUM, sos_score, h)
                        sig |= BIT_SOS
                elif s.outcome == DIR_DIST and age_ok_bear:
                    dom_dn = r_h2 - c_ht * PHASE_D_DOMINANCE_FRAC
                    brk_dn = c < r_l2 - a * BREAK_ATR
                    if c_formal:
                        dom_ok_dn = brk_dn or (c <= dom_dn and close1 <= dom_dn)
                    else:
                        dom_ok_dn = brk_dn or (c <= dom_dn and close1 <= dom_dn and close2 <= dom_dn)
                    req_dn = STRENGTH_MIN_SCORE if c_formal else max(2, STRENGTH_MIN_SCORE - 1)
                    q_dn = sow_score >= req_dn or mb_sow or ((not c_formal) and res3_dn >= 1.0)
                    if dom_ok_dn and q_dn:
                        self._promote_d(s, DIR_DIST, sow_score, l)
                        sig |= BIT_SOW

        # ---- Phase B: rời range (provisional spring/UTAD được "nhận") hoặc reset muộn
        reset_late = -1
        if s.phase == PHASE_B and rk2 and not s.pend:
            d_ht = max(r_h2 - r_l2, mt)
            d_buf = max(d_ht * PHASE_B_DEPARTURE_TR_FRAC, a * PHASE_B_DEPARTURE_ATR)
            up_acc = c > r_h2 + a * BREAK_ATR and close1 > r_h2 + a * BREAK_ATR
            dn_acc = c < r_l2 - a * BREAK_ATR and close1 < r_l2 - a * BREAK_ATR
            up_sus = lo_c_dep > r_h2 + d_buf
            dn_sus = hi_c_dep < r_l2 - d_buf
            up_go = (up_acc and (sos_score >= STRENGTH_MIN_SCORE or mb_sos)) or up_sus
            dn_go = (dn_acc and (sow_score >= STRENGTH_MIN_SCORE or mb_sow)) or dn_sus
            prov_limit = self._phase_idle_limit(PHASE_C, True, p2)
            if up_go and not dn_go:
                up_prov = s.provEdge == DIR_ACCUM and not na(s.provBar) and i - s.provBar <= prov_limit
                if age_ok_bull and up_prov and mature2:
                    self._adopt_prov(s)
                    self._promote_d(s, DIR_ACCUM, sos_score, h)
                    sig |= BIT_SPRING | BIT_SOS
                elif up_sus and not up_prov:
                    reset_late = RS_DEPART
            elif dn_go and not up_go:
                dn_prov = s.provEdge == DIR_DIST and not na(s.provBar) and i - s.provBar <= prov_limit
                if age_ok_bear and dn_prov and mature2:
                    self._adopt_prov(s)
                    self._promote_d(s, DIR_DIST, sow_score, l)
                    sig |= BIT_UTAD | BIT_SOW
                elif dn_sus and not dn_prov:
                    reset_late = RS_DEPART
        if reset_late >= 0:
            self.rs_counts[reset_late] += 1
            self.last_reset_why = reset_late
            s = self.s = WS()

        # ---- làm mới SOS/SOW sau LPS/LPSY
        if s.phase == PHASE_D and s.outcome == DIR_ACCUM and s.ev == EV_LPS and not na(s.rangeHigh):
            if c > s.rangeHigh + a * BREAK_ATR and rel_e >= STRENGTH_VOL_MULT and c_pos >= SOS_CLOSE_MIN:
                s.strBar = i
                s.strPrice = h
                s.strScore = sos_score
                self._set_event(s, EV_SOS)
                sig |= BIT_SOS
        if s.phase == PHASE_D and s.outcome == DIR_DIST and s.ev == EV_LPSY and not na(s.rangeLow):
            if c < s.rangeLow - a * BREAK_ATR and rel_e >= STRENGTH_VOL_MULT and c_pos <= SOW_CLOSE_MAX:
                s.strBar = i
                s.strPrice = l
                s.strScore = sow_score
                self._set_event(s, EV_SOW)
                sig |= BIT_SOW

        # ---- chấp nhận giá ngoài range -> Phase E
        if s.phase == PHASE_D and not na(s.rangeHigh) and not na(s.rangeLow):
            e_conf = self._conf(s)
            d_age = i - s.dStartBar if not na(s.dStartBar) else 0
            d_min = max(PHASE_D_MIN_BARS, max(int(nz(s.pivLen, live_len)), 1))
            if s.outcome == DIR_ACCUM:
                s.outCount = s.outCount + 1 if c > s.rangeHigh else 0
                e_opp_ok = self.regime != REGIME_MARKDOWN or s.cfLPS
                e_std = (s.cfLPS and not na(s.lpsBar) and i - s.lpsBar >= CONFIRM_BARS and d_age >= d_min
                         and lo_c_conf > s.rangeHigh and e_conf >= MIN_CONFIDENCE_PHASE_D)
                e_dir = ((not s.cfLPS) and d_age >= max(d_min, DIRECT_ACCEPTANCE_BARS) and lo_c_dir > s.rangeHigh
                         and e_conf >= DIRECT_ACCEPTANCE_CONFIDENCE)
                if (e_std or e_dir) and e_opp_ok:
                    s.cfAccept = True
                    s.phase = PHASE_E
                    s.eStartBar = i
                    self.regime = REGIME_MARKUP
                    self.regime_bar = i
                    self._set_event(s, EV_MARKUP)
                    sig |= BIT_E
            elif s.outcome == DIR_DIST:
                s.outCount = s.outCount + 1 if c < s.rangeLow else 0
                e_opp_ok = self.regime != REGIME_MARKUP or s.cfLPS
                e_std = (s.cfLPS and not na(s.lpsBar) and i - s.lpsBar >= CONFIRM_BARS and d_age >= d_min
                         and hi_c_conf < s.rangeLow and e_conf >= MIN_CONFIDENCE_PHASE_D)
                e_dir = ((not s.cfLPS) and d_age >= max(d_min, DIRECT_ACCEPTANCE_BARS) and hi_c_dir < s.rangeLow
                         and e_conf >= DIRECT_ACCEPTANCE_CONFIDENCE)
                if (e_std or e_dir) and e_opp_ok:
                    s.cfAccept = True
                    s.phase = PHASE_E
                    s.eStartBar = i
                    self.regime = REGIME_MARKDOWN
                    self.regime_bar = i
                    self._set_event(s, EV_MARKDOWN)
                    sig |= BIT_E

        # =========================== ENTRY QUALIFICATION ===========================
        if na(s.entryBar) and s.outcome != DIR_NONE:
            cfg = ENTRY_CFG[self.strictness]
            e_val = self._validation(s, int(nz(s.pivLen, live_len)), trend_score, a)
            e_ready = self._entry_readiness(s, cfg["conf"], cfg["val"], a, c)
            e_quality = self._conf(s) >= cfg["conf"] and e_val >= cfg["val"] and e_ready >= cfg["tests"]
            test_bit = bool(sig & (BIT_TEST | BIT_CTEST))
            strength_bit = bool(sig & (BIT_SOS | BIT_SOW))
            lps_bit = bool(sig & (BIT_LPS | BIT_LPSY))
            st = self.strictness
            agg_test = st == "Aggressive" and test_bit and e_quality
            agg_strength = st == "Aggressive" and strength_bit and e_quality and na(s.testBar)
            std_test = st == "Standard" and test_bit and e_quality and s.testScore >= TEST_MIN_SCORE
            std_lps = st == "Standard" and lps_bit and e_quality
            con_lps = st == "Conservative" and lps_bit and e_quality
            if agg_test or agg_strength or std_test or std_lps or con_lps:
                s.entryBar = i
                s.entryKind = ENTRY_LPS if (std_lps or con_lps) else (ENTRY_STRENGTH if agg_strength else ENTRY_TEST)

        return sig, trend_score
