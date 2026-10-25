import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  clampParams,
  defaultParams,
  normalizeSymbol,
  type Interval,
  type Paper,
  type Params,
} from "@/lib/engine";

type DeskState = {
  symbols: string[];
  active: string;
  interval: Interval;
  params: Params;
  journal: Paper[];
  hydrated: boolean;
  setActive: (symbol: string) => void;
  setInterval: (interval: Interval) => void;
  addSymbol: (raw: string) => string | null;
  removeSymbol: (symbol: string) => void;
  setParams: (patch: Partial<Params>) => void;
  resetParams: () => void;
  setJournal: (journal: Paper[]) => void;
  clearJournal: () => void;
};

const memory = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
};

function deskStorage() {
  const base = typeof window === "undefined" ? memoryStorage : localStorage;
  return {
    getItem: (key: string) => {
      const raw = base.getItem(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { state?: unknown; version?: unknown };
        if (parsed && typeof parsed === "object" && parsed.state && typeof parsed.version !== "number") {
          return JSON.stringify({ ...parsed, version: 0 });
        }
      } catch {
        return raw;
      }
      return raw;
    },
    setItem: (key: string, value: string) => base.setItem(key, value),
    removeItem: (key: string) => base.removeItem(key),
  };
}

export const useDesk = create<DeskState>()(
  persist(
    (set, get) => ({
      symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"],
      active: "BTCUSDT",
      interval: "5m",
      params: defaultParams,
      journal: [],
      hydrated: false,
      setActive: (active) => set({ active }),
      setInterval: (interval) => set({ interval }),
      addSymbol: (raw) => {
        const symbol = normalizeSymbol(raw);
        if (symbol.length < 5 || symbol.length > 20) return "Nhập mã, ví dụ SOL hoặc ETHUSDT.";
        const symbols = get().symbols;
        if (symbols.includes(symbol)) {
          set({ active: symbol });
          return null;
        }
        if (symbols.length >= 8) return "Tối đa 8 cặp trên bàn.";
        set({ symbols: [...symbols, symbol], active: symbol });
        return null;
      },
      removeSymbol: (symbol) => {
        const symbols = get().symbols.filter((item) => item !== symbol);
        if (symbols.length === 0) return;
        const active = get().active === symbol ? symbols[0] : get().active;
        set({ symbols, active });
      },
      setParams: (patch) => set({ params: clampParams({ ...get().params, ...patch }) }),
      resetParams: () => set({ params: defaultParams }),
      setJournal: (journal) => set({ journal }),
      clearJournal: () => set({ journal: [] }),
    }),
    {
      name: "orca-desk",
      version: 2,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== "object") return persisted;
        const state = persisted as { interval?: Interval; params?: Params };
        if (version < 1 && state.params?.smaDist === 2) {
          state.params = { ...state.params, smaDist: 0.3 };
        }
        if (version < 2) {
          state.interval = "5m";
          state.params = {
            ...(state.params ?? defaultParams),
            atrPeriod: 14,
            smaDist: 0.1,
            smaLook: 2,
            slPct: 6,
            tpPct: 3.2,
            requireSma: false,
          };
        }
        return state;
      },
      storage: createJSONStorage(deskStorage),
      skipHydration: true,
      partialize: (state) => ({
        symbols: state.symbols,
        active: state.active,
        interval: state.interval,
        params: state.params,
        journal: state.journal,
      }),
    },
  ),
);
