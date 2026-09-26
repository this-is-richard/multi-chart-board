const DEFAULT_SYMBOLS = [
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "NASDAQ:AAPL",
  "NASDAQ:TSLA",
  "NYSE:SPY",
  "FOREXCOM:SPXUSD",
  "BINANCE:SOLUSDT",
  "TVC:GOLD",
];

const STORAGE_KEY = "multi-chart-board-v2";
const STORAGE_KEY_V1 = "multi-chart-board-v1";

const SMA50_COLOR = "#14B8A6";
const SMA200_COLOR = "#A855F7";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const chartCountEl = document.getElementById("chartCount");
const intervalEl = document.getElementById("interval");
const themeEl = document.getElementById("theme");
const applyBtn = document.getElementById("applyBtn");
const symbolPanel = document.getElementById("symbolPanel");
const chartGrid = document.getElementById("chartGrid");

/** @type {{ chart: any, ro?: ResizeObserver }[]} */
let activeCharts = [];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSymbols(count) {
  const inputs = [...symbolPanel.querySelectorAll("input[data-symbol]")];
  const fromInputs = inputs.map((el) => el.value.trim()).filter(Boolean);
  const symbols = [];
  for (let i = 0; i < count; i += 1) {
    symbols.push(fromInputs[i] || DEFAULT_SYMBOLS[i] || "NASDAQ:AAPL");
  }
  return symbols;
}

function renderSymbolInputs(count, symbols) {
  symbolPanel.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const row = document.createElement("div");
    row.className = "symbol-row";
    const label = document.createElement("label");
    label.htmlFor = `symbol-${i}`;
    label.textContent = `Chart ${i + 1}`;
    const input = document.createElement("input");
    input.id = `symbol-${i}`;
    input.type = "text";
    input.dataset.symbol = "1";
    input.placeholder = "EXCHANGE:SYMBOL";
    input.value = symbols[i] || DEFAULT_SYMBOLS[i] || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    row.append(label, input);
    symbolPanel.appendChild(row);
  }
}

function destroyCharts() {
  for (const entry of activeCharts) {
    try {
      entry.ro?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      entry.chart?.remove();
    } catch {
      /* ignore */
    }
  }
  activeCharts = [];
}

function sma(closes, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i += 1) {
    sum += closes[i].close;
    if (i >= period) sum -= closes[i - period].close;
    if (i >= period - 1) {
      out.push({ time: closes[i].time, value: sum / period });
    }
  }
  return out;
}

function themeOptions(theme) {
  const dark = theme === "dark";
  return {
    layout: {
      background: { type: "solid", color: dark ? "#131722" : "#ffffff" },
      textColor: dark ? "#d1d4dc" : "#1a2332",
    },
    grid: {
      vertLines: { color: dark ? "#1e2636" : "#e8edf5" },
      horzLines: { color: dark ? "#1e2636" : "#e8edf5" },
    },
    rightPriceScale: {
      borderColor: dark ? "#2a3548" : "#d5dde8",
    },
    timeScale: {
      borderColor: dark ? "#2a3548" : "#d5dde8",
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: 0,
    },
  };
}

function candleColors(theme) {
  const dark = theme === "dark";
  return {
    upColor: dark ? "#26a69a" : "#089981",
    downColor: dark ? "#ef5350" : "#f23645",
    borderUpColor: dark ? "#26a69a" : "#089981",
    borderDownColor: dark ? "#ef5350" : "#f23645",
    wickUpColor: dark ? "#26a69a" : "#089981",
    wickDownColor: dark ? "#ef5350" : "#f23645",
  };
}

async function fetchOhlcv(symbol, interval) {
  const qs = new URLSearchParams({ symbol, interval });
  const res = await fetch(`/api/ohlcv?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  if (!data.candles || !data.candles.length) {
    throw new Error("No candles returned");
  }
  return data;
}

function setStatus(el, text, isError = false) {
  if (!el) return;
  if (!text) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden");
  el.classList.toggle("error", isError);
  el.textContent = text;
}

function createCard(symbol) {
  const card = document.createElement("div");
  card.className = "chart-card";

  const header = document.createElement("div");
  header.className = "chart-header";

  const title = document.createElement("div");
  title.className = "chart-symbol";
  title.textContent = symbol;

  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = `
    <span class="legend-item"><span class="swatch sma50"></span>SMA 50</span>
    <span class="legend-item"><span class="swatch sma200"></span>SMA 200</span>
  `;

  header.append(title, legend);

  const host = document.createElement("div");
  host.className = "chart-host";

  const status = document.createElement("div");
  status.className = "chart-status";
  status.textContent = "Loading…";

  host.appendChild(status);
  card.append(header, host);
  return { card, host, status, title };
}

function mountChart(host, candles, theme) {
  if (typeof LightweightCharts === "undefined") {
    throw new Error("Lightweight Charts failed to load");
  }

  const chart = LightweightCharts.createChart(host, {
    autoSize: true,
    ...themeOptions(theme),
  });

  const candleSeries = chart.addCandlestickSeries(candleColors(theme));
  candleSeries.setData(
    candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
  );

  const sma50Series = chart.addLineSeries({
    color: SMA50_COLOR,
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  sma50Series.setData(sma(candles, 50));

  const sma200Series = chart.addLineSeries({
    color: SMA200_COLOR,
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  sma200Series.setData(sma(candles, 200));

  chart.timeScale().fitContent();

  let ro;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({
          width: host.clientWidth,
          height: host.clientHeight,
        });
      } catch {
        /* ignore */
      }
    });
    ro.observe(host);
  }

  return { chart, ro };
}

async function renderCharts({ count, symbols, interval, theme }) {
  destroyCharts();
  document.body.classList.toggle("theme-light", theme === "light");
  chartGrid.className = `grid cols-${count}`;
  chartGrid.innerHTML = "";

  const jobs = [];

  for (let i = 0; i < count; i += 1) {
    const symbol = symbols[i];
    const { card, host, status } = createCard(symbol);
    chartGrid.appendChild(card);

    jobs.push(
      (async () => {
        await sleep(i * 120);
        try {
          setStatus(status, "Loading…");
          const data = await fetchOhlcv(symbol, interval);
          const entry = mountChart(host, data.candles, theme);
          activeCharts.push(entry);
          setStatus(status, "");
        } catch (err) {
          setStatus(status, err.message || String(err), true);
        }
      })()
    );
  }

  await Promise.all(jobs);
}

async function applyBoard() {
  const count = Number(chartCountEl.value);
  const interval = intervalEl.value;
  const theme = themeEl.value;
  const symbols = getSymbols(count);

  renderSymbolInputs(count, symbols);
  saveState({ count, symbols, interval, theme });

  applyBtn.disabled = true;
  try {
    await renderCharts({ count, symbols, interval, theme });
  } finally {
    applyBtn.disabled = false;
  }
}

function boot() {
  const saved = loadState();
  const count = saved?.count || 6;
  const symbols = saved?.symbols?.length
    ? saved.symbols
    : DEFAULT_SYMBOLS.slice(0, count);
  const interval = saved?.interval || "D";
  const theme = saved?.theme || "dark";

  chartCountEl.value = String(count);
  intervalEl.value = interval;
  themeEl.value = theme;
  document.body.classList.toggle("theme-light", theme === "light");
  renderSymbolInputs(count, symbols);

  const start = () => applyBoard();
  if (typeof LightweightCharts !== "undefined") start();
  else window.addEventListener("load", start);
}

chartCountEl.addEventListener("change", () => {
  const count = Number(chartCountEl.value);
  const symbols = getSymbols(count);
  while (symbols.length < count) {
    symbols.push(DEFAULT_SYMBOLS[symbols.length] || "NASDAQ:AAPL");
  }
  renderSymbolInputs(count, symbols.slice(0, count));
});

applyBtn.addEventListener("click", () => {
  applyBoard();
});

symbolPanel.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyBoard();
  }
});

boot();
