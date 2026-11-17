"""Bar-by-bar backtester with costs, stops and performance metrics."""
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .strategy import Params, add_signals


@dataclass
class Result:
    equity: pd.Series
    trades: pd.DataFrame
    stats: dict = field(default_factory=dict)


def run_backtest(df: pd.DataFrame, p: Params = Params(), capital: float = 100_000,
                 cost_pct: float = 0.001) -> Result:
    """cost_pct = one-way brokerage + taxes + slippage (0.1% default)."""
    d = add_signals(df, p)
    cash, qty = capital, 0
    entry_px = stop = trail_high = target = 0.0
    entry_date = None
    pending = None  # "buy" / "sell" order to fill at next open
    trades, equity = [], []

    o, h, l, c = d["Open"].values, d["High"].values, d["Low"].values, d["Close"].values
    a, ent, ext, idx = d["atr"].values, d["entry"].values, d["exit"].values, d.index

    def close_pos(i, px, reason):
        nonlocal cash, qty
        cash += qty * px * (1 - cost_pct)
        trades.append(dict(entry_date=entry_date, exit_date=idx[i], entry=entry_px, exit=px,
                           qty=qty, pnl=qty * (px * (1 - cost_pct) - entry_px * (1 + cost_pct)),
                           ret_pct=(px / entry_px - 1) * 100, reason=reason))
        qty = 0

    for i in range(len(d)):
        # 1) Fill orders queued yesterday at today's open
        if pending == "buy" and qty == 0:
            eq = cash
            risk_per_share = p.stop_atr * a[i - 1]
            if risk_per_share > 0:
                n = int(min(eq * p.risk_pct / risk_per_share,
                            eq * p.max_alloc / (o[i] * (1 + cost_pct))))
                if n > 0:
                    qty, entry_px, entry_date = n, o[i], idx[i]
                    cash -= n * o[i] * (1 + cost_pct)
                    stop = o[i] - risk_per_share
                    trail_high = o[i]
                    target = o[i] + p.target_r * risk_per_share if p.target_r > 0 else np.inf
        elif pending == "sell" and qty > 0:
            close_pos(i, o[i], "signal")
        pending = None

        # 2) Intrabar stop / target checks (stop assumed first = conservative)
        if qty > 0:
            eff_stop = max(stop, trail_high - p.trail_atr * a[i - 1])
            if l[i] <= eff_stop:
                close_pos(i, min(o[i], eff_stop), "stop")  # gap-down fills at open
            elif h[i] >= target:
                close_pos(i, max(o[i], target), "target")
            else:
                trail_high = max(trail_high, c[i])

        # 3) Generate tomorrow's order from today's close
        if qty == 0 and ent[i]:
            pending = "buy"
        elif qty > 0 and ext[i]:
            pending = "sell"

        equity.append(cash + qty * c[i])

    if qty > 0:
        close_pos(len(d) - 1, c[-1], "end")
        equity[-1] = cash

    eq = pd.Series(equity, index=idx, name="equity")
    tr = pd.DataFrame(trades)
    return Result(eq, tr, compute_stats(eq, tr, d["Close"], capital))


def compute_stats(eq: pd.Series, tr: pd.DataFrame, close: pd.Series, capital: float) -> dict:
    rets = eq.pct_change().dropna()
    years = max((eq.index[-1] - eq.index[0]).days / 365.25, 1e-9)
    dd = eq / eq.cummax() - 1
    s = {
        "Start": eq.index[0].date(), "End": eq.index[-1].date(),
        "Final equity": round(eq.iloc[-1], 2),
        "Total return %": round((eq.iloc[-1] / capital - 1) * 100, 2),
        "CAGR %": round(((eq.iloc[-1] / capital) ** (1 / years) - 1) * 100, 2),
        "Buy & hold %": round((close.iloc[-1] / close.iloc[0] - 1) * 100, 2),
        "Max drawdown %": round(dd.min() * 100, 2),
        "Sharpe": round(rets.mean() / rets.std() * np.sqrt(252), 2) if rets.std() > 0 else 0.0,
        "Trades": len(tr),
    }
    if len(tr):
        wins, losses = tr[tr.pnl > 0], tr[tr.pnl <= 0]
        s["Win rate %"] = round(len(wins) / len(tr) * 100, 1)
        s["Profit factor"] = round(wins.pnl.sum() / abs(losses.pnl.sum()), 2) if len(losses) and losses.pnl.sum() else float("inf")
        s["Avg win %"] = round(wins.ret_pct.mean(), 2) if len(wins) else 0
        s["Avg loss %"] = round(losses.ret_pct.mean(), 2) if len(losses) else 0
        s["Time in market %"] = round(
            sum((r.exit_date - r.entry_date).days for r in tr.itertuples())
            / max((eq.index[-1] - eq.index[0]).days, 1) * 100, 1)
    return s
