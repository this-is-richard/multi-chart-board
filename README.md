# Multi Chart Board

Static page of TradingView free Advanced Chart embeds (1–16 charts) with default-colored 50 and 200 SMAs. No backend.

Paste comma- or space-separated US tickers (e.g. `NVDA, MU, AVGO`). Bare symbols resolve via a static US exchange map (`NASDAQ` / `NYSE` / `AMEX`); unknowns default to `NASDAQ:`. Prefixed `EXCHANGE:SYMBOL` values are kept as-is. Chart count follows the ticker list (max 16).

Saved ticker sets and settings stay in your browser (`localStorage`).

## Live

https://this-is-richard.github.io/multi-chart-board/

Use `http://localhost:…` for local testing if `127.0.0.1` fails to load TradingView embeds.

## Run locally

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Then open http://localhost:5173
