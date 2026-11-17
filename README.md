# Trend-Momentum Trading Algo

A long-only, rules-based swing/positional trading algorithm with a built-in backtester.
Works on any instrument with daily OHLC data (Nifty, Bank Nifty, NSE stocks, US stocks, crypto).

## Strategy rules

**Entry (all must be true at the daily close; buy at next day's open):**
1. Close > EMA 200 — only trade in a primary uptrend
2. EMA 20 > EMA 50 — medium-term trend is up
3. ADX(14) > 20 — trend is strong, not choppy
4. RSI(14) between 50 and 70 — momentum is positive but not overbought

**Exit (whichever comes first):**
- Initial stop loss: entry − 2 × ATR(14)
- Trailing stop: highest close since entry − 3 × ATR(14)
- Trend break: EMA 20 crosses below EMA 50, or close < EMA 200

**Position sizing:** risk 1% of equity per trade (shares = 1% of equity ÷ stop distance).

**Costs:** 0.1% per side (brokerage, taxes, slippage) is deducted by default.

## Usage

```bash
pip install -r requirements.txt

python run.py --symbol ^NSEI                      # Nifty 50 backtest since 2010
python run.py --symbol RELIANCE.NS --start 2015-01-01 --trades trades.csv
python run.py --symbol ^NSEBANK --signal          # today's signal + suggested stop
python run.py --csv my_data.csv                   # Date,Open,High,Low,Close
python run.py --demo                              # synthetic data, offline test
```

Change parameters (EMA lengths, ATR multiples, risk %, optional take-profit) in `algo/strategy.py` → `Params`.

## Important

- No strategy is "best" in every market. Trend following wins big in trending markets and
  takes many small losses in sideways ones (expect a win rate of ~30–45% with larger average wins).
- Backtest on several instruments and time periods, then paper trade before risking real money.
- This is educational code, not financial advice.
