#!/usr/bin/env python3
"""Run the Trend-Momentum algo.

Examples:
  python run.py --symbol ^NSEI                # Nifty 50 (Yahoo Finance)
  python run.py --symbol RELIANCE.NS --start 2015-01-01
  python run.py --symbol ^NSEBANK --signal    # today's signal only
  python run.py --csv mydata.csv              # columns: Date,Open,High,Low,Close
  python run.py --demo                        # synthetic data, no internet needed
"""
import argparse

import numpy as np
import pandas as pd

from algo import Params, add_signals, run_backtest


def load_yahoo(symbol: str, start: str) -> pd.DataFrame:
    import yfinance as yf
    df = yf.download(symbol, start=start, auto_adjust=True, progress=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    if df.empty:
        raise SystemExit(f"No data for {symbol}")
    return df[["Open", "High", "Low", "Close"]].dropna()


def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=[0], index_col=0)
    df.columns = [c.strip().title() for c in df.columns]
    return df[["Open", "High", "Low", "Close"]].dropna().sort_index()


def demo_data(n: int = 2500, seed: int = 7) -> pd.DataFrame:
    """Regime-switching random walk (trending + choppy phases)."""
    rng = np.random.default_rng(seed)
    drift = np.repeat(rng.choice([0.0012, -0.0008, 0.0], size=n // 125 + 1), 125)[:n]
    r = drift + rng.normal(0, 0.012, n)
    close = 10000 * np.exp(np.cumsum(r))
    open_ = close * np.exp(rng.normal(0, 0.003, n))
    high = np.maximum(open_, close) * np.exp(np.abs(rng.normal(0, 0.006, n)))
    low = np.minimum(open_, close) * np.exp(-np.abs(rng.normal(0, 0.006, n)))
    idx = pd.bdate_range("2015-01-01", periods=n)
    return pd.DataFrame(dict(Open=open_, High=high, Low=low, Close=close), index=idx)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--symbol")
    src.add_argument("--csv")
    src.add_argument("--demo", action="store_true")
    ap.add_argument("--start", default="2010-01-01")
    ap.add_argument("--capital", type=float, default=100_000)
    ap.add_argument("--cost", type=float, default=0.001, help="one-way cost incl. slippage (0.001 = 0.1%%)")
    ap.add_argument("--risk", type=float, default=0.01, help="fraction of equity risked per trade")
    ap.add_argument("--signal", action="store_true", help="print only the latest signal")
    ap.add_argument("--trades", type=str, help="save trade log to this CSV")
    args = ap.parse_args()

    df = demo_data() if args.demo else load_csv(args.csv) if args.csv else load_yahoo(args.symbol, args.start)
    p = Params(risk_pct=args.risk)

    if args.signal:
        last = add_signals(df, p).iloc[-1]
        action = "BUY / HOLD LONG" if last.entry else "EXIT / STAY FLAT" if last.exit else "NO NEW ENTRY (hold if already long)"
        print(f"Date: {last.name.date()}  Close: {last.Close:.2f}")
        print(f"EMA20 {last.ema_fast:.2f} | EMA50 {last.ema_slow:.2f} | EMA200 {last.ema_regime:.2f}")
        print(f"RSI {last.rsi:.1f} | ADX {last.adx:.1f} | ATR {last.atr:.2f}")
        print(f"Signal: {action}")
        if last.entry:
            print(f"Suggested stop: {last.Close - p.stop_atr * last.atr:.2f}")
        return

    res = run_backtest(df, p, capital=args.capital, cost_pct=args.cost)
    print("\n=== Trend-Momentum Backtest ===")
    for k, v in res.stats.items():
        print(f"{k:<18} {v}")
    if len(res.trades):
        print("\nLast 5 trades:")
        print(res.trades.tail(5).round({"entry": 2, "exit": 2, "pnl": 2, "ret_pct": 2}).to_string(index=False))
        if args.trades:
            res.trades.to_csv(args.trades, index=False)
            print(f"\nTrade log saved to {args.trades}")


if __name__ == "__main__":
    main()
