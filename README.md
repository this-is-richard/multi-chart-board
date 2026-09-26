# Multi Chart Board

TradingView free Advanced Chart embeds, 1–8 per page, with 50 and 200 SMA (default widget colors).

Paste comma- or space-separated US tickers in the **Tickers** box (e.g. `NVDA, MU, AVGO`). Bare symbols are resolved via a static US exchange map (`NASDAQ` / `NYSE` / `AMEX`); unknowns default to `NASDAQ:`. Prefixed `EXCHANGE:SYMBOL` values are kept as-is. Chart count follows the ticker list (max 8).

## Run

```bash
cd /workspace/tradingview-multi-chart
python3 -m http.server 5173 --bind 127.0.0.1
```

Open http://127.0.0.1:5173
