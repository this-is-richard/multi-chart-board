const DEFAULT_TICKERS = "AAPL, MSFT, NVDA, TSLA, AMZN, META";
const MAX_CHARTS = 16;
const STORAGE_KEY = "multi-chart-board-v2";
const LEGACY_STORAGE_KEY = "multi-chart-board-v1";
const SETS_STORAGE_KEY = "multi-chart-board-sets-v1";

/** Common US tickers → TradingView exchange prefix (no external API). */
const US_EXCHANGE_MAP = {
  // NASDAQ
  NVDA: "NASDAQ",
  MU: "NASDAQ",
  AVGO: "NASDAQ",
  AAPL: "NASDAQ",
  TSLA: "NASDAQ",
  MSFT: "NASDAQ",
  AMZN: "NASDAQ",
  GOOGL: "NASDAQ",
  GOOG: "NASDAQ",
  META: "NASDAQ",
  AMD: "NASDAQ",
  INTC: "NASDAQ",
  QCOM: "NASDAQ",
  NFLX: "NASDAQ",
  COST: "NASDAQ",
  PEP: "NASDAQ",
  CSCO: "NASDAQ",
  ADBE: "NASDAQ",
  PYPL: "NASDAQ",
  INTU: "NASDAQ",
  AMAT: "NASDAQ",
  TXN: "NASDAQ",
  SBUX: "NASDAQ",
  BKNG: "NASDAQ",
  ISRG: "NASDAQ",
  REGN: "NASDAQ",
  VRTX: "NASDAQ",
  MDLZ: "NASDAQ",
  ADP: "NASDAQ",
  PANW: "NASDAQ",
  SNPS: "NASDAQ",
  CDNS: "NASDAQ",
  KLAC: "NASDAQ",
  LRCX: "NASDAQ",
  MRVL: "NASDAQ",
  ADI: "NASDAQ",
  MPWR: "NASDAQ",
  NXPI: "NASDAQ",
  MCHP: "NASDAQ",
  ON: "NASDAQ",
  FSLR: "NASDAQ",
  SWKS: "NASDAQ",
  ASML: "NASDAQ",
  PLTR: "NASDAQ",
  DDOG: "NASDAQ",
  ADSK: "NASDAQ",
  WDAY: "NASDAQ",
  PTC: "NASDAQ",
  TRMB: "NASDAQ",
  SNDK: "NASDAQ",
  STX: "NASDAQ",
  WDC: "NASDAQ",
  NTAP: "NASDAQ",
  SMCI: "NASDAQ",
  LITE: "NASDAQ",
  FFIV: "NASDAQ",
  CRWD: "NASDAQ",
  FTNT: "NASDAQ",
  GEN: "NASDAQ",
  TER: "NASDAQ",
  ROP: "NASDAQ",
  ZBRA: "NASDAQ",
  CTSH: "NASDAQ",
  FLEX: "NASDAQ",
  VRSN: "NASDAQ",
  AKAM: "NASDAQ",
  ORCL: "NYSE",
  // NYSE
  JPM: "NYSE",
  V: "NYSE",
  MA: "NYSE",
  WMT: "NYSE",
  XOM: "NYSE",
  CVX: "NYSE",
  BAC: "NYSE",
  DIS: "NYSE",
  KO: "NYSE",
  PFE: "NYSE",
  IBM: "NYSE",
  GS: "NYSE",
  CAT: "NYSE",
  BA: "NYSE",
  GE: "NYSE",
  HD: "NYSE",
  MCD: "NYSE",
  NKE: "NYSE",
  UNH: "NYSE",
  JNJ: "NYSE",
  PG: "NYSE",
  MRK: "NYSE",
  ABBV: "NYSE",
  TMO: "NYSE",
  ACN: "NYSE",
  LIN: "NYSE",
  ABT: "NYSE",
  WFC: "NYSE",
  MS: "NYSE",
  C: "NYSE",
  SCHW: "NYSE",
  BLK: "NYSE",
  AXP: "NYSE",
  RTX: "NYSE",
  LMT: "NYSE",
  HON: "NYSE",
  UPS: "NYSE",
  DE: "NYSE",
  MMM: "NYSE",
  GM: "NYSE",
  F: "NYSE",
  T: "NYSE",
  VZ: "NYSE",
  NEE: "NYSE",
  SO: "NYSE",
  DUK: "NYSE",
  SPGI: "NYSE",
  CRM: "NYSE",
  FICO: "NYSE",
  TYL: "NYSE",
  DELL: "NYSE",
  HPE: "NYSE",
  P: "NYSE",
  HPQ: "NYSE",
  ANET: "NYSE",
  MSI: "NYSE",
  CIEN: "NYSE",
  NOW: "NYSE",
  Q: "NYSE",
  KEYS: "NYSE",
  TDY: "NYSE",
  IT: "NYSE",
  APH: "NYSE",
  GLW: "NYSE",
  COHR: "NYSE",
  TEL: "NYSE",
  JBL: "NYSE",
  GDDY: "NYSE",
  // ETFs (AMEX on TradingView)
  SPY: "AMEX",
  QQQ: "AMEX",
  IWM: "AMEX",
  DIA: "AMEX",
  VOO: "AMEX",
  VTI: "AMEX",
  GLD: "AMEX",
  SLV: "AMEX",
  IWF: "AMEX",
  IWD: "AMEX",
  XLF: "AMEX",
  XLK: "AMEX",
  XLE: "AMEX",
  ARKK: "AMEX",
  TQQQ: "AMEX",
  SQQQ: "AMEX",
};

const chartCountEl = document.getElementById("chartCount");
const intervalEl = document.getElementById("interval");
const themeEl = document.getElementById("theme");
const applyBtn = document.getElementById("applyBtn");
const tickersInput = document.getElementById("tickersInput");
const resolvedLine = document.getElementById("resolvedLine");
const statusLine = document.getElementById("statusLine");
const chartGrid = document.getElementById("chartGrid");

/**
 * Resolve a bare or prefixed ticker to a TradingView EXCHANGE:SYMBOL.
 * US-first static map; unknown bare tickers default to NASDAQ.
 */
function resolveSymbol(raw) {
  const trimmed = String(raw || "").trim().toUpperCase();
  if (!trimmed) return null;
  if (trimmed.includes(":")) return trimmed;
  const exchange = US_EXCHANGE_MAP[trimmed] || "NASDAQ";
  return `${exchange}:${trimmed}`;
}

function parseTickers(raw) {
  return String(raw || "")
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function resolveTickers(raw) {
  const parts = parseTickers(raw);
  const symbols = [];
  for (const part of parts) {
    const resolved = resolveSymbol(part);
    if (resolved) symbols.push(resolved);
  }
  return symbols;
}

function symbolsToTickerString(symbols) {
  return (symbols || [])
    .map((s) => {
      const idx = String(s).indexOf(":");
      return idx >= 0 ? String(s).slice(idx + 1) : String(s);
    })
    .filter(Boolean)
    .join(", ");
}

function updateResolvedUI(symbols, truncated) {
  resolvedLine.textContent = symbols.length
    ? symbols.join(" · ")
    : "";
  statusLine.textContent = truncated
    ? `Showing first ${MAX_CHARTS} of more tickers entered.`
    : "";
  const metaLine = document.getElementById("metaLine");
  if (metaLine) {
    const hasContent = Boolean(resolvedLine.textContent || statusLine.textContent);
    metaLine.hidden = !hasContent;
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }

  // Migrate v1 → v2
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    const old = JSON.parse(legacy);
    const symbols = Array.isArray(old.symbols) ? old.symbols.filter(Boolean) : [];
    const tickers = symbolsToTickerString(symbols) || DEFAULT_TICKERS;
    return {
      tickers,
      symbols: symbols.length ? symbols : resolveTickers(tickers),
      count: old.count || Math.min(MAX_CHARTS, Math.max(1, symbols.length || 6)),
      interval: old.interval || "D",
      theme: old.theme || "dark",
    };
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderCharts({ count, symbols, interval, theme }) {
  chartGrid.className = `grid cols-${count}`;
  chartGrid.innerHTML = "";

  for (let i = 0; i < count; i += 1) {
    const card = document.createElement("div");
    card.className = "chart-card";
    const host = document.createElement("div");
    const containerId = `tv_chart_${i}_${Date.now()}`;
    host.id = containerId;
    host.className = "tv-host";
    card.appendChild(host);
    chartGrid.appendChild(card);

    // TradingView.widget needs the node in the DOM before construction.
    // SMAs only — no studies_overrides / color config.
    // eslint-disable-next-line no-new
    new TradingView.widget({
      autosize: true,
      symbol: symbols[i],
      interval,
      timezone: "Asia/Hong_Kong",
      theme,
      style: "1",
      locale: "en",
      toolbar_bg: theme === "dark" ? "#131722" : "#f1f3f6",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      container_id: containerId,
      withdateranges: true,
      allow_symbol_change: true,
      details: false,
      hotlist: false,
      calendar: false,
      studies: [
        { id: "MASimple@tv-basicstudies", inputs: { length: 50 } },
        { id: "MASimple@tv-basicstudies", inputs: { length: 200 } },
      ],
    });
  }
}

/**
 * Apply from the Tickers field: parse → resolve → clamp 1–MAX_CHARTS → sync Charts dropdown.
 */
function applyFromTickers() {
  if (typeof TradingView === "undefined") {
    chartGrid.innerHTML =
      "<p style='padding:16px;color:#8b9bb0'>TradingView script failed to load. Check the network and refresh.</p>";
    return;
  }

  const rawTickers = tickersInput.value.trim() || DEFAULT_TICKERS;
  const allResolved = resolveTickers(rawTickers);
  const truncated = allResolved.length > MAX_CHARTS;
  const symbols = allResolved.slice(0, MAX_CHARTS);

  if (!symbols.length) {
    statusLine.textContent = "Enter at least one ticker.";
    resolvedLine.textContent = "";
    return;
  }

  const count = symbols.length;
  const interval = intervalEl.value;
  const theme = themeEl.value;

  tickersInput.value = rawTickers;
  chartCountEl.value = String(count);
  updateResolvedUI(symbols, truncated);
  renderCharts({ count, symbols, interval, theme });
  saveState({ tickers: rawTickers, symbols, count, interval, theme });
}

/**
 * Charts dropdown override: truncate or (prefer not to invent) keep within list.
 * If count > current symbols length, do not pad with random cryptos — re-apply from tickers
 * and only show what's available, or if tickers empty use defaults up to count.
 */
function applyFromChartCount() {
  if (typeof TradingView === "undefined") return;

  let desired = Number(chartCountEl.value) || 6;
  desired = Math.min(MAX_CHARTS, Math.max(1, desired));

  let allResolved = resolveTickers(tickersInput.value);
  if (!allResolved.length) {
    allResolved = resolveTickers(DEFAULT_TICKERS);
    tickersInput.value = DEFAULT_TICKERS;
  }

  // Truncate when shrinking; when growing, only use what's in the ticker list (no inventing).
  const symbols = allResolved.slice(0, Math.min(desired, allResolved.length));
  const count = symbols.length || 1;
  chartCountEl.value = String(count);

  // Sync ticker string display to match shown set when truncated by count
  if (allResolved.length > count) {
    tickersInput.value = symbolsToTickerString(symbols);
  }

  const interval = intervalEl.value;
  const theme = themeEl.value;
  updateResolvedUI(symbols, false);
  renderCharts({ count, symbols, interval, theme });
  saveState({
    tickers: tickersInput.value,
    symbols,
    count,
    interval,
    theme,
  });
}

function applyBoard() {
  applyFromTickers();
}

function boot() {
  const saved = loadState();
  const tickers = saved?.tickers || DEFAULT_TICKERS;
  const symbols =
    saved?.symbols?.length > 0
      ? saved.symbols.slice(0, MAX_CHARTS)
      : resolveTickers(tickers).slice(0, MAX_CHARTS);
  const count = Math.min(
    MAX_CHARTS,
    Math.max(1, saved?.count || symbols.length || 6)
  );
  const interval = saved?.interval || "D";
  const theme = saved?.theme || "dark";
  const finalSymbols = symbols.slice(0, count);

  tickersInput.value = tickers;
  chartCountEl.value = String(finalSymbols.length || count);
  intervalEl.value = interval;
  themeEl.value = theme;
  updateResolvedUI(finalSymbols, false);

  const start = () => {
    if (typeof TradingView === "undefined") {
      chartGrid.innerHTML =
        "<p style='padding:16px;color:#8b9bb0'>TradingView script failed to load. Check the network and refresh.</p>";
      return;
    }
    renderCharts({
      count: finalSymbols.length,
      symbols: finalSymbols,
      interval,
      theme,
    });
    saveState({
      tickers,
      symbols: finalSymbols,
      count: finalSymbols.length,
      interval,
      theme,
    });
  };

  if (typeof TradingView !== "undefined") start();
  else window.addEventListener("load", start);
}




/* ── Built-in ticker set presets ───────────────────────────────────── */

const BUILTIN_SETS = [
  {
    id: "builtin-semiconductors",
    name: "Semiconductors",
    tickers:
      "NVDA, AVGO, MU, AMD, INTC, TXN, MRVL, QCOM, ADI, MPWR, NXPI, MCHP, ON, FSLR, SWKS",
  },
  {
    id: "builtin-application-software",
    name: "Application Software",
    tickers:
      "PLTR, ORCL, CRM, ADBE, CDNS, DDOG, SNPS, INTU, ADSK, WDAY, FICO, PTC, TRMB, TYL",
  },
  {
    id: "builtin-tech-hardware",
    name: "Tech Hardware & Storage",
    tickers: "AAPL, SNDK, STX, WDC, DELL, HPE, P, NTAP, HPQ, SMCI",
  },
  {
    id: "builtin-communications-equipment",
    name: "Communications Equipment",
    tickers: "CSCO, ANET, LITE, MSI, CIEN, FFIV",
  },
  {
    id: "builtin-systems-software",
    name: "Systems Software",
    tickers: "MSFT, PANW, CRWD, NOW, FTNT, GEN",
  },
  {
    id: "builtin-semi-materials-equipment",
    name: "Semi Materials & Equipment",
    tickers: "LRCX, AMAT, KLAC, TER, Q",
  },
  {
    id: "builtin-electronic-equipment",
    name: "Electronic Equipment & Instruments",
    tickers: "KEYS, ROP, TDY, ZBRA",
  },
  {
    id: "builtin-it-consulting",
    name: "IT Consulting",
    tickers: "IBM, ACN, CTSH, IT",
  },
  {
    id: "builtin-electronic-components",
    name: "Electronic Components",
    tickers: "APH, GLW, COHR",
  },
  {
    id: "builtin-ems",
    name: "Electronic Manufacturing Services",
    tickers: "TEL, FLEX, JBL",
  },
  {
    id: "builtin-internet-services",
    name: "Internet Services",
    tickers: "VRSN, AKAM, GDDY",
  },
];

/** Insert missing builtin sets by id; never overwrite an existing id. */
function ensureBuiltinSets() {
  const store = loadSetsStore();
  let changed = false;
  for (const builtin of BUILTIN_SETS) {
    if (store.sets.some((s) => s.id === builtin.id)) continue;
    store.sets.push({
      id: builtin.id,
      name: builtin.name,
      tickers: builtin.tickers,
      updatedAt: Date.now(),
    });
    changed = true;
  }
  if (changed) saveSetsStore(store);
}

/* ── Saved ticker sets (localStorage only) ─────────────────────────── */

const setsBtn = document.getElementById("setsBtn");
const setsPopout = document.getElementById("setsPopout");
const setsListEl = document.getElementById("setsList");
const setsEmptyEl = document.getElementById("setsEmpty");
const setNameInput = document.getElementById("setNameInput");
const saveSetBtn = document.getElementById("saveSetBtn");

function loadSetsStore() {
  try {
    const raw = localStorage.getItem(SETS_STORAGE_KEY);
    if (!raw) return { sets: [], lastUsedId: null };
    const data = JSON.parse(raw);
    const sets = Array.isArray(data?.sets) ? data.sets : [];
    return {
      sets: sets
        .filter((s) => s && typeof s.name === "string" && typeof s.tickers === "string")
        .map((s) => ({
          id: String(s.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
          name: s.name.trim(),
          tickers: s.tickers.trim(),
          updatedAt: Number(s.updatedAt) || Date.now(),
        }))
        .filter((s) => s.name && s.tickers),
      lastUsedId: data?.lastUsedId ? String(data.lastUsedId) : null,
    };
  } catch {
    return { sets: [], lastUsedId: null };
  }
}

function saveSetsStore(store) {
  localStorage.setItem(
    SETS_STORAGE_KEY,
    JSON.stringify({
      sets: store.sets || [],
      lastUsedId: store.lastUsedId || null,
    })
  );
}

function setSubtitle(tickers) {
  const parts = parseTickers(tickers);
  const n = parts.length;
  if (!n) return "0 tickers";
  const preview = parts.slice(0, 3).join(", ");
  const more = n > 3 ? ` +${n - 3}` : "";
  return `${n} · ${preview}${more}`;
}

function renderSetsList() {
  if (!setsListEl || !setsEmptyEl) return;
  const store = loadSetsStore();
  // Newest first
  const sets = [...store.sets].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  setsListEl.innerHTML = "";
  setsEmptyEl.hidden = sets.length > 0;

  for (const set of sets) {
    const li = document.createElement("li");
    li.className = "sets-item" + (store.lastUsedId === set.id ? " is-active" : "");
    li.dataset.id = set.id;

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "sets-item-btn";
    loadBtn.title = `Load “${set.name}”`;

    const nameEl = document.createElement("span");
    nameEl.className = "sets-item-name";
    nameEl.textContent = set.name;

    const metaEl = document.createElement("span");
    metaEl.className = "sets-item-meta";
    metaEl.textContent = setSubtitle(set.tickers);

    loadBtn.appendChild(nameEl);
    loadBtn.appendChild(metaEl);
    loadBtn.addEventListener("click", () => {
      loadTickerSet(set.id);
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "sets-item-delete";
    delBtn.setAttribute("aria-label", `Delete set ${set.name}`);
    delBtn.title = "Delete";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteTickerSet(set.id);
    });

    li.appendChild(loadBtn);
    li.appendChild(delBtn);
    setsListEl.appendChild(li);
  }
}

function saveCurrentAsSet() {
  const name = (setNameInput?.value || "").trim();
  if (!name) {
    setNameInput?.focus();
    statusLine.textContent = "Enter a name for this set.";
    const metaLine = document.getElementById("metaLine");
    if (metaLine) metaLine.hidden = false;
    return;
  }

  const tickers = (tickersInput.value || "").trim();
  const parts = parseTickers(tickers);
  if (!parts.length) {
    statusLine.textContent = "Enter at least one ticker before saving a set.";
    const metaLine = document.getElementById("metaLine");
    if (metaLine) metaLine.hidden = false;
    return;
  }

  const store = loadSetsStore();
  const existing = store.sets.find(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  );
  const now = Date.now();

  if (existing) {
    existing.tickers = tickers;
    existing.name = name; // keep casing from latest save
    existing.updatedAt = now;
    store.lastUsedId = existing.id;
  } else {
    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    store.sets.push({ id, name, tickers, updatedAt: now });
    store.lastUsedId = id;
  }

  saveSetsStore(store);
  if (setNameInput) setNameInput.value = "";
  renderSetsList();
  statusLine.textContent = existing
    ? `Updated set “${name}”.`
    : `Saved set “${name}”.`;
  const metaLine = document.getElementById("metaLine");
  if (metaLine) metaLine.hidden = false;
}

function loadTickerSet(id) {
  const store = loadSetsStore();
  const set = store.sets.find((s) => s.id === id);
  if (!set) return;

  tickersInput.value = set.tickers;
  store.lastUsedId = set.id;
  saveSetsStore(store);
  renderSetsList();
  setSetsOpen(false);
  applyFromTickers();
}

function deleteTickerSet(id) {
  const store = loadSetsStore();
  const before = store.sets.length;
  store.sets = store.sets.filter((s) => s.id !== id);
  if (store.lastUsedId === id) store.lastUsedId = null;
  if (store.sets.length === before) return;
  saveSetsStore(store);
  renderSetsList();
}

function setSetsOpen(open) {
  if (!setsBtn || !setsPopout) return;
  setsPopout.hidden = !open;
  setsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    setSettingsOpen(false);
    renderSetsList();
    setNameInput?.focus();
  }
}

function toggleSets() {
  const open = setsPopout && setsPopout.hidden;
  setSetsOpen(Boolean(open));
}

/* ── Settings + Sets popouts ───────────────────────────────────────── */

const settingsBtn = document.getElementById("settingsBtn");
const settingsPopout = document.getElementById("settingsPopout");

function setSettingsOpen(open) {
  if (!settingsBtn || !settingsPopout) return;
  settingsPopout.hidden = !open;
  settingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) setSetsOpen(false);
}

function toggleSettings() {
  const open = settingsPopout && settingsPopout.hidden;
  setSettingsOpen(Boolean(open));
}

if (settingsBtn && settingsPopout) {
  settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettings();
  });

  settingsPopout.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

if (setsBtn && setsPopout) {
  setsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSets();
  });

  setsPopout.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  saveSetBtn?.addEventListener("click", () => {
    saveCurrentAsSet();
  });

  setNameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveCurrentAsSet();
    }
  });
}

document.addEventListener("click", () => {
  setSettingsOpen(false);
  setSetsOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setSettingsOpen(false);
    setSetsOpen(false);
  }
});

if (settingsBtn && settingsPopout) {
  // Changing settings in the popout should apply (interval/theme) or use existing chart-count handler
  intervalEl.addEventListener("change", () => {
    applyFromTickers();
    setSettingsOpen(false);
  });
  themeEl.addEventListener("change", () => {
    applyFromTickers();
    setSettingsOpen(false);
  });
}

chartCountEl.addEventListener("change", () => {
  applyFromChartCount();
  setSettingsOpen(false);
});

applyBtn.addEventListener("click", applyBoard);

tickersInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyBoard();
  }
});

// Live preview of resolved symbols as the user types
tickersInput.addEventListener("input", () => {
  const all = resolveTickers(tickersInput.value);
  const truncated = all.length > MAX_CHARTS;
  updateResolvedUI(all.slice(0, MAX_CHARTS), truncated);
});

boot();
ensureBuiltinSets();
renderSetsList();

// Export for sanity checks in Node (optional)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    resolveSymbol,
    parseTickers,
    resolveTickers,
    US_EXCHANGE_MAP,
    MAX_CHARTS,
    BUILTIN_SETS,
    ensureBuiltinSets,
    loadSetsStore,
    saveSetsStore,
    SETS_STORAGE_KEY,
  };
}
