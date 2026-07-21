# Nina Zhou

Auckland, NZ · nina.zhou@example.com · github.com/ninazhou-quant

## Education

**BSc (Hons) Computational Finance — University of Auckland** (2022–2025)
GPA 8.7/9.0. Relevant: Stochastic Calculus, Time Series Analysis, Financial Econometrics, Algorithmic Trading.

## Experience

**Quantitative Research Intern — Kepler Capital (prop trading firm, Auckland)** (Nov 2024 – Feb 2025)
Small prop desk (8 traders); I was the only intern on the quant side.
- Built a backtesting engine for intraday equity mean-reversion strategies: ingested 3 years of tick data from the NZX (2.5B+ ticks) into a local ClickHouse instance. The engine simulates realistic execution by modeling order-book depth at each price level and applying a fill-probability model calibrated from historical market-impact data.
- Discovered that our primary signal (gap-to-VWAP) had survivorship bias: the backtest used the current NZX 50 constituents, but historical constituents that were delisted (and thus underperformed) were missing. Correcting this reduced signal Sharpe from 2.1 to 0.8. Wrote a pipeline that reconstructs historical index membership from NZX daily bulletins.
- Built a real-time options-pricing dashboard in Python/Streamlit: Black-Scholes with volatility surface interpolation (SVI parameterisation, calibrated every 5 minutes from order-book implied vols). Used by 3 traders for intraday monitoring.

**Data Analyst (part-time) — EconInsight (economic consulting)** (2023–2024)
- Cleaned and structured 15+ years of RBNZ monetary-policy statements for an NLP sentiment-analysis project. Wrote a Python pipeline that parses PDF releases, extracts policy-rate decisions, and aligns them with market-implied rate expectations from OIS futures.

## Projects

**PairTradingRL** (2025, BSc Hons dissertation)
- Implemented a reinforcement-learning approach to statistical arbitrage: trained a PPO agent to learn pair-trading entry/exit rules on cointegrated NZX equity pairs. The agent outperformed a baseline distance-based strategy by 14% Sharpe (out-of-sample, 2023–2024 data). Key insight: the RL agent learned to scale position size with cointegration strength, which the baseline couldn't do. Used reward shaping to penalise drawdowns and transaction costs. Wrote a custom Gym environment that simulates NZX market microstructure with bid-ask spreads and volume-based slippage.

**VolSurfaceVis** (2024)
- Interactive volatility surface visualiser (React + D3.js + Flask) pulling live options data from Interactive Brokers API. 300+ stars on GitHub. Used by 2 university quant-finance courses as a teaching tool.

## Skills

Python (numpy, pandas, scikit-learn, PyTorch, statsmodels), R, SQL, ClickHouse, Streamlit, Docker, Git, Bloomberg Terminal (basic), IB API

## Competitions

- 3rd place, NZX Quantitative Trading Challenge 2024 (pair-trading strategy, team of 2)
- Top 20%, Optiver "Ready Trader Go" 2024
