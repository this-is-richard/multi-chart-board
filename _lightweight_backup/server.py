#!/usr/bin/env python3
"""Static file server + OHLCV proxy for Multi Chart Board."""

from __future__ import annotations

import json
import math
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import time

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 5173

YAHOO_ALIASES = {
    "FOREXCOM:SPXUSD": "^GSPC",
    "TVC:GOLD": "GC=F",
}

BINANCE_INTERVAL = {
    "1": "1m",
    "5": "5m",
    "15": "15m",
    "60": "1h",
    "240": "4h",
    "D": "1d",
    "W": "1w",
}

YAHOO_INTERVAL = {
    "1": "1m",
    "5": "5m",
    "15": "15m",
    "60": "1h",
    "240": "1h",  # bucketed to 4h client-side in fetch_yahoo
    "D": "1d",
    "W": "1wk",
}

YAHOO_RANGE = {
    "1": "7d",
    "5": "60d",
    "15": "60d",
    "60": "730d",
    "240": "730d",
    "D": "10y",
    "W": "20y",
}


def http_get_json(url: str, timeout: float = 25.0) -> dict | list:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; MultiChartBoard/1.0)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def resolve_symbol(symbol: str) -> tuple[str, str]:
    """Return (source, resolved_symbol). source is 'binance' or 'yahoo'."""
    raw = (symbol or "").strip()
    upper = raw.upper()

    if upper in YAHOO_ALIASES:
        return "yahoo", YAHOO_ALIASES[upper]

    if upper.startswith("BINANCE:"):
        return "binance", upper.split(":", 1)[1]

    # Bare *USDT treated as Binance spot
    if upper.endswith("USDT") and ":" not in upper and upper.isascii():
        return "binance", upper

    if ":" in raw:
        # EXCHANGE:TICKER -> ticker for Yahoo (NASDAQ:AAPL -> AAPL)
        ticker = raw.split(":", 1)[1]
        return "yahoo", ticker

    return "yahoo", raw


BINANCE_HOSTS = (
    "https://api.binance.com",
    "https://data-api.binance.vision",
    "https://api.binance.us",
)


def fetch_binance(pair: str, interval: str) -> list[dict]:
    bi = BINANCE_INTERVAL.get(interval, "1d")
    limit = 1000
    qs = urllib.parse.urlencode({"symbol": pair.upper(), "interval": bi, "limit": limit})
    last_err: Exception | None = None
    rows = None
    for host in BINANCE_HOSTS:
        url = f"{host}/api/v3/klines?{qs}"
        try:
            rows = http_get_json(url)
            break
        except urllib.error.HTTPError as exc:
            last_err = exc
            # Geo-block / WAF / rate-limit — try next host
            if exc.code in (418, 429, 451, 403):
                continue
            raise
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            continue
    if rows is None:
        raise last_err or RuntimeError("binance unavailable")
    candles = []
    for row in rows:
        # [openTime, open, high, low, close, volume, ...]
        ts = int(row[0]) // 1000
        candles.append(
            {
                "time": ts,
                "open": float(row[1]),
                "high": float(row[2]),
                "low": float(row[3]),
                "close": float(row[4]),
                "volume": float(row[5]),
            }
        )
    return candles


def _bucket_4h(candles: list[dict]) -> list[dict]:
    """Aggregate 1h Yahoo bars into 4h buckets (UTC-aligned)."""
    if not candles:
        return []
    buckets: dict[int, dict] = {}
    order: list[int] = []
    for c in candles:
        key = (c["time"] // 14400) * 14400
        if key not in buckets:
            buckets[key] = {
                "time": key,
                "open": c["open"],
                "high": c["high"],
                "low": c["low"],
                "close": c["close"],
                "volume": c["volume"],
            }
            order.append(key)
        else:
            b = buckets[key]
            b["high"] = max(b["high"], c["high"])
            b["low"] = min(b["low"], c["low"])
            b["close"] = c["close"]
            b["volume"] = b["volume"] + c["volume"]
    return [buckets[k] for k in order]


YAHOO_HOSTS = (
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
)

# Simple process-local cache to absorb parallel chart loads / Yahoo rate limits.
_CACHE: dict[tuple[str, str], tuple[float, dict]] = {}
_CACHE_LOCK = threading.Lock()
_CACHE_TTL_SEC = 60.0
_FETCH_LOCK = threading.Lock()  # serialize Yahoo to cut 429s on Apply


def _parse_yahoo_chart(data: dict, interval: str) -> list[dict]:
    result = (data.get("chart") or {}).get("result") or []
    if not result:
        err = ((data.get("chart") or {}).get("error") or {}).get("description") or "No data"
        raise ValueError(err)

    chart = result[0]
    timestamps = chart.get("timestamp") or []
    quote = ((chart.get("indicators") or {}).get("quote") or [{}])[0]
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    candles = []
    for i, ts in enumerate(timestamps):
        o, h, l, c = (
            opens[i] if i < len(opens) else None,
            highs[i] if i < len(highs) else None,
            lows[i] if i < len(lows) else None,
            closes[i] if i < len(closes) else None,
        )
        if any(v is None or (isinstance(v, float) and math.isnan(v)) for v in (o, h, l, c)):
            continue
        vol = volumes[i] if i < len(volumes) and volumes[i] is not None else 0
        if isinstance(vol, float) and math.isnan(vol):
            vol = 0
        candles.append(
            {
                "time": int(ts),
                "open": float(o),
                "high": float(h),
                "low": float(l),
                "close": float(c),
                "volume": float(vol),
            }
        )

    if interval == "240":
        candles = _bucket_4h(candles)
    return candles


def fetch_yahoo(ticker: str, interval: str) -> list[dict]:
    yi = YAHOO_INTERVAL.get(interval, "1d")
    rng = YAHOO_RANGE.get(interval, "10y")
    encoded = urllib.parse.quote(ticker, safe="^=")
    qs = urllib.parse.urlencode(
        {
            "interval": yi,
            "range": rng,
            "includePrePost": "false",
            "events": "div,splits",
        }
    )
    tickers = [ticker]
    # Common index alias fallbacks
    if ticker in {"^GSPC", "SPXUSD"}:
        tickers = ["^GSPC", "SPY"]

    last_err: Exception | None = None
    for attempt in range(4):
        for host in YAHOO_HOSTS:
            for t in tickers:
                enc = urllib.parse.quote(t, safe="^=")
                url = f"{host}/v8/finance/chart/{enc}?{qs}"
                try:
                    data = http_get_json(url)
                    return _parse_yahoo_chart(data, interval)
                except urllib.error.HTTPError as exc:
                    last_err = exc
                    if exc.code in (429, 500, 502, 503, 504):
                        time.sleep(0.4 * (attempt + 1))
                        continue
                    if exc.code == 404:
                        continue  # try alias
                    raise
                except Exception as exc:  # noqa: BLE001
                    last_err = exc
                    time.sleep(0.2 * (attempt + 1))
                    continue
    raise last_err or RuntimeError(f"yahoo unavailable for {ticker}")


def get_ohlcv(symbol: str, interval: str) -> dict:
    key = (symbol.strip().upper(), interval)
    now = time.time()
    with _CACHE_LOCK:
        hit = _CACHE.get(key)
        if hit and now - hit[0] < _CACHE_TTL_SEC:
            return hit[1]

    # Serialize upstream fetches so Apply with 6–8 Yahoo symbols is less likely to 429.
    with _FETCH_LOCK:
        now = time.time()
        with _CACHE_LOCK:
            hit = _CACHE.get(key)
            if hit and now - hit[0] < _CACHE_TTL_SEC:
                return hit[1]

        source, resolved = resolve_symbol(symbol)
        if source == "binance":
            candles = fetch_binance(resolved, interval)
            src_label = "binance"
        else:
            candles = fetch_yahoo(resolved, interval)
            src_label = "yahoo"
        payload = {
            "symbol": symbol,
            "source": src_label,
            "candles": candles,
        }
        with _CACHE_LOCK:
            _CACHE[key] = (time.time(), payload)
        return payload


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/ohlcv":
            self._handle_ohlcv(parsed)
            return
        return super().do_GET()

    def _handle_ohlcv(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        symbol = (qs.get("symbol") or [""])[0].strip()
        interval = (qs.get("interval") or ["D"])[0].strip() or "D"
        if not symbol:
            self._json(400, {"error": "symbol is required"})
            return
        if interval not in BINANCE_INTERVAL:
            self._json(400, {"error": f"unsupported interval: {interval}"})
            return
        try:
            payload = get_ohlcv(symbol, interval)
            self._json(200, payload)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:400]
            self._json(502, {"error": f"upstream HTTP {exc.code}", "detail": body})
        except Exception as exc:  # noqa: BLE001
            self._json(502, {"error": str(exc)})

    def _json(self, status: int, payload: dict):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        print(f"[server] {self.address_string()} {fmt % args}")


def main():
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Serving {ROOT} at http://{HOST}:{PORT}")
    print("API: GET /api/ohlcv?symbol=BINANCE:BTCUSDT&interval=D")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
