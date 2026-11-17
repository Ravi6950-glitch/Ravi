"""Trend-Momentum strategy with volatility-based risk management.

Why this design: no strategy is "best" in every market, but the most robust,
well-documented edge for retail traders is trend following with strict risk
control. This combines:

  1. Regime filter  - only trade long when Close > EMA200 (primary uptrend)
  2. Trend trigger  - fast EMA above slow EMA (EMA20 > EMA50)
  3. Trend strength - ADX > 20 (avoid choppy, sideways markets)
  4. Momentum       - RSI between 50 and 70 (strong but not overbought)
  5. Risk           - ATR stop loss, ATR trailing stop, fixed % risk per trade

All signals are computed on the bar's close and executed on the NEXT bar's
open, so there is no look-ahead bias.
"""
from dataclasses import dataclass

import pandas as pd

from .indicators import adx, atr, ema, rsi


@dataclass
class Params:
    fast: int = 20
    slow: int = 50
    regime: int = 200
    rsi_len: int = 14
    rsi_min: float = 50
    rsi_max: float = 70
    adx_min: float = 20
    atr_len: int = 14
    stop_atr: float = 2.0       # initial stop = entry - 2 * ATR
    trail_atr: float = 3.0      # chandelier trailing stop = highest close - 3 * ATR
    target_r: float = 0.0       # optional take-profit in R multiples (0 = off, let winners run)
    risk_pct: float = 0.01      # risk 1% of equity per trade
    max_alloc: float = 1.0      # never put more than 100% of equity in one position


def add_signals(df: pd.DataFrame, p: Params) -> pd.DataFrame:
    df = df.copy()
    df["ema_fast"] = ema(df["Close"], p.fast)
    df["ema_slow"] = ema(df["Close"], p.slow)
    df["ema_regime"] = ema(df["Close"], p.regime)
    df["rsi"] = rsi(df["Close"], p.rsi_len)
    df["adx"] = adx(df, p.atr_len)
    df["atr"] = atr(df, p.atr_len)

    df["entry"] = (
        (df["Close"] > df["ema_regime"])
        & (df["ema_fast"] > df["ema_slow"])
        & (df["adx"] > p.adx_min)
        & df["rsi"].between(p.rsi_min, p.rsi_max)
    )
    # Trend broken: fast EMA crosses below slow EMA, or price loses the regime line
    df["exit"] = (df["ema_fast"] < df["ema_slow"]) | (df["Close"] < df["ema_regime"])
    # Warm-up period: no trading until indicators are meaningful
    df.loc[df.index[: p.regime], ["entry"]] = False
    return df
