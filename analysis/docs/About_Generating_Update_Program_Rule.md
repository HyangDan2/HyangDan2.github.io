# Stock Analysis Static Data Harness Rule

## Purpose

This document defines the harness rules for an Agentic AI updater that generates static stock-analysis data for GitHub Pages.

The updater must work from a generic input pair:

```text
market + ticker
```

Examples:

```text
TSE 7013
KRX 012450
HK.09880
NYSE LMT
NASDAQ NVDA
XETRA RHM
```

The output must be static HTML/CSS/JavaScript/JSON that can run on GitHub Pages without a backend server. The page must load `latest.json`, then load the timestamped raw data JSON referenced by it.

## Input Contract

The updater must accept an input object similar to:

```json
{
  "market": "TSE",
  "ticker": "7013",
  "asset_type": "stock",
  "company_hint": "IHI Corporation",
  "analysis_date": "2026-05-10",
  "update_mode": "full",
  "language_set": ["ko", "en", "ja"],
  "output_base_dir": "analysis"
}
```

Required fields:

- `market`
- `ticker`
- `analysis_date`
- `output_base_dir`

Optional fields:

- `asset_type` (`stock`, `etf`; infer from verified identity when omitted)
- `company_hint`
- `fund_hint`
- `update_mode` (`full`, `price_only`, `holdings_only`, `index_only`; default `full`)
- `language_set`
- `peer_hints`
- `segment_hints`
- `source_hints`
- `force_refresh`

If `asset_type` is omitted, the updater must verify whether the target is a listed company, ETF, ETN, fund, preferred share, warrant, or another listed instrument before selecting the generation rules. Do not assume every ticker is common stock.

If `update_mode` is omitted, the updater must perform a full update. Reduced update modes are allowed only when the existing latest raw JSON is valid and the requested target identity matches it.

## Market And Ticker Normalization Rule

The updater must normalize folder and file names as:

```text
{MARKET}{TICKER}
```

Rules:

- Uppercase the market code.
- Preserve leading zeros in tickers.
- Remove spaces and separators from the folder/file key.
- Do not add exchange suffixes to folder names.
- Keep exchange suffixes only inside JSON data when useful for market-data lookup.

Examples:

- `TSE 7013` -> `TSE7013`
- `KRX 012450` -> `KRX012450`
- `HK.09880` -> `HK09880`
- `NYSE LMT` -> `NYSELMT`
- `NASDAQ NVDA` -> `NASDAQNVDA`
- `XETRA RHM` -> `XETR RHM` is invalid; use `XETRA RHM` -> `XETRARHM`

## Output Path Rule

The updater must write files under:

```text
analysis/{MARKET}{TICKER}/
```

Required output structure:

```text
analysis/
└─ {MARKET}{TICKER}/
   ├─ {MARKET}{TICKER}.html
   ├─ {MARKET}{TICKER}.css
   ├─ {MARKET}{TICKER}.js
   ├─ latest.json
   └─ raw_data/
      └─ {YYYYMMDD_HHMMSS_KST}.json
```

Examples:

```text
analysis/TSE7013/TSE7013.html
analysis/KRX012450/KRX012450.html
analysis/NYSELMT/NYSELMT.html
```

`latest.json` must contain only the newest raw-data pointer:

```json
{
  "latest": "raw_data/20260510_161157_KST.json"
}
```

The updater must not modify the site root `index.html` by default. Create or update the standalone analysis page only. Add index/home links only when the user explicitly requests them.

## GitHub Pages URL Rule

The final page must be reachable as:

```text
https://HyangDan2.github.io/analysis/{MARKET}{TICKER}/{MARKET}{TICKER}.html
```

Examples:

```text
https://HyangDan2.github.io/analysis/TSE7013/TSE7013.html
https://HyangDan2.github.io/analysis/KRX012450/KRX012450.html
https://HyangDan2.github.io/analysis/NYSELMT/NYSELMT.html
```

## Language Rule

Default language set:

- `ko`
- `en`
- `ja`

Every generated user-facing analysis field must provide all requested languages.

Standard multilingual object:

```json
{
  "ko": "...",
  "en": "...",
  "ja": "..."
}
```

If a translation cannot be generated confidently, the updater must still provide a short neutral version and record the limitation in `data_quality.notes`.

The UI language buttons should use:

- `KOR`
- `ENG`
- `JPN`

For future expansion, the updater may support local-language sets, but `ko/en/ja` is the baseline for this project.

## Target Identity Verification Rule

Before generating analysis, the updater must verify the target identity from trusted sources.

Required stock identity fields:

- company name
- market
- ticker
- exchange
- currency
- sector or industry
- official company website or IR page, when available

Required ETF identity fields:

- fund name
- market
- ticker
- exchange
- currency
- asset type (`ETF`)
- issuer or asset manager
- brand, when available
- benchmark or comparison index
- replication method, when available
- listing date, when available
- ISIN, when available
- official fund page, when available

If `company_hint` conflicts with verified identity, the updater must stop or write a clear failure report. Do not silently proceed with a mismatched company.

If a ticker verifies as an ETF, the updater must not generate company financial-statement analysis for the issuer or asset manager. The issuer is a product provider, not the investment target.

Examples:

- `TSE 7013` must verify as IHI Corporation.
- `TSE 7011` must verify as Mitsubishi Heavy Industries.
- `KRX 012450` must verify as Hanwha Aerospace.
- `NYSE LMT` must verify as Lockheed Martin.
- `KRX 0162L0` must verify as KODEX China AI Semiconductor TOP10 ETF, not a common stock.

## Market-Specific Source Rule

Use market-appropriate primary sources first.

TSE / Japan:

- Company IR
- JPX
- TDnet
- Kabutan or other auditable market-data pages
- Japanese reputable news sources

KRX / Korea:

- Company IR
- DART
- KRX
- KRX ETF, K-ETF, issuer ETF pages, and ETF disclosures for ETF products
- Naver Finance / FnGuide / other auditable market-data pages
- Korean reputable news sources

HK / Hong Kong:

- Company IR
- HKEX
- HKEXnews filings and announcements
- Auditable market-data pages such as Google Finance, Yahoo Finance, TradingView, MarketScreener, or equivalent quote pages
- Hong Kong, mainland China, and global reputable financial news sources

Hong Kong ticker normalization:

- User inputs may arrive as `HK.09880`, `HK 09880`, `09880.HK`, or `9880:HKG`.
- Preserve leading zeros in folder names, manifest tickers, and canonical JSON fields:
  - `market`: `HK`
  - `ticker`: `09880`
  - `key`: `HK09880`
  - folder: `analysis/HK09880/`
- Source lookup symbols may remove the leading zero when the source requires it:
  - HKEX quote query: `sym=9880`
  - Google Finance: `9880:HKG`
  - Yahoo Finance: `9880.HK`
- Do not write the folder as `HK9880`; use `HK09880`.
- Display the ticker as `HK 09880` or `09880.HK` only after preserving the canonical ticker.

Hong Kong currency handling:

- Listed price, market capitalization, support/resistance levels, and share-price technical levels normally use `HKD`.
- Issuer financial statements for mainland China or Greater China issuers may report in `CNY` or `RMB`.
- The updater must keep `price_snapshot.currency` and `financials.currency` separate when they differ.
- The renderer must not reuse `KRW`, `JPY`, or single-currency formatters for HK pages.
- If the financial statement currency cannot be verified, mark the financial fields partial and explain the limitation in `data_quality.notes`.

Hong Kong holiday handling:

- HKEX holiday notices must be checked when the analysis date falls near a Hong Kong market holiday.
- If HKEX is closed, use the latest confirmed trading day and explain the date difference in all requested languages.
- Example: if the requested page date is `2026-06-20` and HKEX was closed on `2026-06-19`, use `2026-06-18` as the latest confirmed trading day when that is the latest available market snapshot.

NYSE / NASDAQ / US:

- Company IR
- SEC filings
- Earnings releases and transcripts
- Exchange or auditable market-data pages
- Reputable financial news sources

Europe:

- Company IR
- Exchange pages such as Xetra, LSE, Euronext, Borsa Italiana
- Regulatory filings
- Reputable regional and global news sources

## Required JSON Schema

Each raw data JSON must include:

```json
{
  "schema_version": "1.1.0",
  "generated_at": "...",
  "input": {},
  "identity": {},
  "as_of": {},
  "price_snapshot": {},
  "recent_prices": [],
  "monthly_prices": [],
  "financials": {},
  "etf_profile": {},
  "holdings": [],
  "holdings_snapshot": {},
  "holdings_changes": {},
  "theme_exposure_map": [],
  "business_segment_map": [],
  "peer_group": [],
  "news_events": [],
  "technical_view": {},
  "trading_scenarios": {},
  "sources": [],
  "data_quality": {},
  "disclaimer": {}
}
```

Backward compatibility:

- Existing pages may use `target` instead of `identity`.
- Existing pages may use `segment_sector_map` instead of `business_segment_map`.
- New updaters should prefer `identity` and `business_segment_map`, but may emit aliases if the current page renderer requires them.

Asset-type handling:

- For `asset_type: "stock"`, `financials`, `business_segment_map`, and company peer rules are required.
- For `asset_type: "etf"`, `etf_profile`, `holdings`, `theme_exposure_map`, and ETF peer rules are required.
- ETF raw JSON may leave stock-only fields empty only when the renderer can clearly hide or relabel those sections.
- The page must display the verified asset type near the title or summary so users do not mistake an ETF for a company stock.

Update-mode handling:

- `full` generates or refreshes the full raw JSON and static page.
- `holdings_only` refreshes ETF holdings-related fields while preserving long-form analysis fields.
- `price_only` may refresh price and chart fields without regenerating fundamental or scenario text.
- `index_only` may refresh the analysis index manifest without touching target raw data.
- Any reduced update mode must fail if the existing `latest.json` or raw JSON cannot be loaded.

## Date Rule

The updater must distinguish:

- `generated_at`: when the JSON was generated
- `as_of.page_date`: the analysis date
- `as_of.market_data_date`: the latest market close used
- `timezone`: normally `Asia/Seoul` for this project

If the analysis date falls on a weekend or market holiday, use the latest confirmed trading day and explain this in all requested languages.

## Price Data Rule

`price_snapshot` must include:

- source
- date
- open
- high
- low
- close
- change
- change_percent
- volume
- currency

The page renderer must use the currency from raw JSON, not a hard-coded formatter. Never reuse a formatter such as `jpyB()` or a literal `"JPY"`/`"KRW"` from another market page unless the target market currency has been verified.

Currency lookup priority for display:

1. `price_snapshot.currency`
2. `identity.currency`
3. `target.currency`
4. market-derived fallback only after validation

Market-derived fallback examples:

- `KRX` -> `KRW`
- `TSE` -> `JPY`
- `NYSE` / `NASDAQ` -> `USD`
- `XETRA` / `EPA` / `BIT` -> `EUR`
- `LSE` -> `GBP` or `GBX`, depending on source data

All displayed price levels, support/resistance zones, EPS/BPS, dividends, and market-cap values must be checked for currency consistency before the run is marked complete.

`recent_prices` should include enough OHLCV rows to draw a useful chart. Prefer at least 60 trading days when available.

`monthly_prices` should include at least 12 months when available.

## Global Historical Price Rule

For every `full` update, the updater must attempt to collect at least three months of daily historical price data for both stocks and ETFs, regardless of market.

Preferred `recent_prices` fields:

- `date`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `currency`
- `source`

Global source priority:

1. Official exchange or issuer/manager historical data, when accessible.
2. Auditable historical market-data endpoints such as Yahoo Finance chart API, Stooq CSV, exchange CSV downloads, or equivalent public chart APIs.
3. Auditable market-data pages such as Google Finance, Yahoo Finance, TradingView, MarketScreener, Investing.com, or local market-data sites.
4. Latest quote plus 52-week range only as a fallback.

If three months of daily OHLCV cannot be collected:

- Keep a usable `price_snapshot`.
- Keep `recent_prices` only for verified snapshot/reference points.
- Set `data_quality.status` to `partial`.
- Add `3-month OHLCV` or the missing coverage period to `data_quality.missing_fields`.
- Add `price_history_fetch_attempts` or equivalent notes under `data_quality`.
- Do not calculate moving averages, RSI, or volume trend from incomplete data.
- Label the chart and technical analysis as snapshot-based or early chart-structure analysis.

Historical price fetch attempts should record:

- source name
- lookup symbol
- requested range
- result (`success`, `blocked`, `empty`, `rate_limited`, `unsupported`, or `failed`)
- short note

If complete price history is unavailable, the updater must record the limitation in `data_quality.notes`.

## Financial Rule

This rule applies to `asset_type: "stock"`.

The updater must extract, estimate, or clearly mark unavailable:

- revenue
- operating profit
- profit before tax
- net income or profit attributable to owners
- EPS
- BPS
- PER
- PBR
- ROE
- operating margin
- debt ratio
- equity ratio
- total assets
- total equity
- cash flow from operations
- dividend, if relevant
- next-year guidance, if available

All units must be explicit.

The financial analysis text must be generated as three short paragraphs in each requested language:

1. earnings quality and forecast momentum
2. valuation using PER, PBR, EPS, and BPS
3. balance-sheet risk using equity ratio, debt ratio, cash flow, and order or revenue conversion

## ETF Profile Rule

This rule applies to `asset_type: "etf"`.

The updater must extract, estimate, or clearly mark unavailable:

- fund name
- issuer or asset manager
- brand
- benchmark or comparison index
- benchmark index type, such as price return or total return, when known
- replication method, such as physical passive, synthetic, or active
- listing date
- ISIN
- NAV
- market price
- premium or discount to NAV, if available
- assets under management or net assets
- market capitalization, when reported separately
- trading value
- trading volume
- listed shares or units
- total expense ratio
- real expense ratio or other expenses, if available
- distribution policy
- latest distribution and distribution yield, if available
- holdings count
- rebalance frequency
- tax notes, when material

ETF analysis text must be generated as three short paragraphs in each requested language:

1. ETF structure, benchmark, issuer, replication method, and what exposure the product is designed to provide
2. NAV, market price, premium or discount, liquidity, fee, distribution, and tracking-quality interpretation
3. portfolio concentration, currency, country, sector, policy, and benchmark risks

The updater must not use company metrics such as EPS, BPS, PER, PBR, ROE, revenue, operating profit, debt ratio, or cash flow as ETF-level fundamentals unless they are explicitly calculated as portfolio aggregate metrics and labeled as such.

Example ETF identity for `KRX 0162L0`:

```json
{
  "asset_type": "ETF",
  "market": "KRX",
  "ticker": "0162L0",
  "name": "KODEX China AI Semiconductor TOP10 ETF",
  "issuer": "Samsung Asset Management",
  "brand": "KODEX",
  "benchmark": "Indxx China AI Semiconductor Top 10 Index (Price Return)",
  "replication_method": "physical passive",
  "listing_date": "2026-02-26",
  "currency": "KRW",
  "isin": "KR70162L0003"
}
```

## ETF Holdings Rule

This rule applies to `asset_type: "etf"`.

The updater must fetch the most recent available holdings snapshot from official ETF disclosures first, then auditable ETF-data pages if official holdings are unavailable or incomplete.

Each holding should include:

- rank
- name
- ticker or local code, when available
- ISIN, when available
- exchange or market, when available
- country or region
- currency
- sector or theme
- weight
- market value, when available
- shares or quantity, when available
- previous weight or weight change, when available
- holding-level multilingual interpretation

For concentrated thematic ETFs, the updater must identify the top holdings and explain whether the ETF is driven by a few dominant positions or a broad basket. If a holdings source does not provide weights, quantities, or dates, record the limitation in `data_quality.notes`.

When available, ETF raw JSON should also include a holdings snapshot summary:

```json
{
  "holdings_snapshot": {
    "date": "2026-06-19",
    "source": "GoInsider",
    "count": 21,
    "top10_weight": 67.42,
    "changes_summary": {
      "added": [],
      "removed": [],
      "weight_up": [],
      "weight_down": []
    }
  }
}
```

`holdings_changes` may be emitted separately when the source provides detailed adds, removes, and weight changes.

## Holdings-Only Update Rule

This rule applies to `update_mode: "holdings_only"` and `asset_type: "etf"`.

Purpose:

- Refresh ETF portfolio composition without spending tokens on full re-analysis.
- Preserve existing long-form multilingual analysis, scenarios, peer narratives, technical view, and news unless the user explicitly requests a full update.
- Write a new timestamped raw JSON file rather than mutating the existing historical raw file.

Required input example:

```json
{
  "market": "KRX",
  "ticker": "0048K0",
  "asset_type": "etf",
  "update_mode": "holdings_only",
  "analysis_date": "2026-06-20",
  "output_base_dir": "analysis"
}
```

Holdings-only run order:

1. Normalize `market + ticker` and locate `analysis/{MARKET}{TICKER}/latest.json`.
2. Load the existing latest raw JSON.
3. Verify that the existing raw JSON is an ETF and that `identity.market`, `identity.ticker`, fund name, issuer, and benchmark do not conflict with the requested target.
4. Fetch only the newest holdings source data and minimal ETF profile fields directly tied to holdings.
5. Update only the fields allowed by this rule.
6. Validate holdings quality and source dates.
7. Write a new raw file using a holdings-specific timestamp suffix.
8. Update `latest.json` only after validation succeeds.

Allowed fields to update:

- `holdings`
- `holdings_snapshot`
- `holdings_changes`
- `etf_profile.holdings_count`
- `etf_profile.monthly_turnover_percent`, when available
- `etf_profile.rebalance_frequency`, when available
- `etf_profile.tracking_error`, when the source reports it together with holdings
- `as_of.profile_data_date`
- holdings-related `sources`
- concise holdings-related `data_quality.notes`

Fields that must normally be preserved:

- `identity`
- `price_snapshot`
- `recent_prices`
- `monthly_prices`
- `financials`
- `theme_exposure_map`
- `business_segment_map`
- `peer_group`
- `news_events`
- `technical_view`
- `trading_scenarios`
- `disclaimer`

File path rule:

```text
analysis/{MARKET}{TICKER}/raw_data/{YYYYMMDD_HHMMSS_KST}_holdings.json
```

Example:

```text
analysis/KRX0048K0/raw_data/20260620_103000_KST_holdings.json
```

Token-saving rules:

- Do not regenerate long analysis paragraphs in holdings-only mode.
- Preserve existing multilingual analysis text unless a direct holdings field requires a short one-sentence update.
- Limit holding-level interpretation to one short sentence per language per top holding.
- Update the top 10 holdings by default.
- Store additional holdings only when the source is clean and the user asks for full holdings.
- Use `holdings_changes` for adds, removes, and material weight changes instead of rewriting news or scenarios.
- If holdings changes are small, record one concise note in `data_quality.notes`.

Validation rules:

- Holdings-only mode must fail for non-ETF assets.
- The updater must not update `latest.json` if the new holdings array is empty.
- If all new holding names differ from the prior holdings array, treat this as a possible identity or source mismatch and stop.
- If top holding weights sum to more than 100% or contain negative weights, set `data_quality.status` to `partial` or fail the run depending on severity.
- The holdings source date must be recorded in `holdings_snapshot.date` and in `sources`.
- If the holdings source lacks weights, quantities, or dates, write the limitation in `data_quality.notes`.

## Theme Exposure Map Rule

This rule applies to `asset_type: "etf"`.

The updater must generate a theme exposure map based on the ETF's benchmark methodology, holdings, and product objective.

Each item must include:

- `theme_id`
- `theme_name.ko/en/ja`
- `exposure_type` (`direct`, `indirect`, `currency`, `policy`, `liquidity`, `tracking`)
- `portfolio_linkage.ko/en/ja`
- `representative_holdings`
- `drivers`
- `risk_factors`
- `price_linkage.ko/en/ja`

The theme analysis must be written as approximately three paragraphs:

1. what part of the theme the ETF actually owns through its holdings
2. macro, policy, currency, sector, and benchmark drivers
3. how the theme can affect ETF price, NAV, liquidity, premium or discount, and tracking quality

## Business Segment Map Rule

The updater must generate a business segment map based on the actual company, not a fixed template.

Each item must include:

- `segment_id`
- `segment_name.ko/en/ja`
- `company_relevance`
- `segment_linkage.ko/en/ja`
- `tickers`
- `drivers`
- `risk_factors`
- `price_linkage.ko/en/ja`

Allowed `company_relevance` values:

- `direct`
- `direct_adjacent`
- `adjacent`
- `comparison`

The segment analysis must be written as approximately three paragraphs:

1. company business exposure and strategic relevance
2. global peer set and macro/industry drivers
3. how that segment links to the target stock price, including whether the link is direct or indirect

For backward compatibility with current TSE7013 pages, the updater may also emit:

- `segment_sector_map`
- `ihi_relevance`
- `ihi_linkage`

But new generic pages should use `business_segment_map`, `company_relevance`, and `segment_linkage`.

## Peer Group Rule

For `asset_type: "stock"`:

The updater must build peers from three layers:

1. same-market peers
2. global sector peers
3. business-segment peers

Each peer should include:

- company
- ticker
- market or exchange
- region
- currency
- price
- market cap
- PER
- PBR, if available
- ROE, if available
- revenue or sales, if available
- short multilingual peer analysis

Each peer analysis must be approximately three paragraphs:

1. business role and why the peer matters to the target company
2. valuation or earnings comparison
3. read-through to the target stock price or sector narrative

Do not hard-code IHI peers for unrelated companies. Use IHI/MHI/Kawasaki only when analyzing Japanese heavy industry or when they are genuinely relevant.

For `asset_type: "etf"`:

The updater must build ETF peers from three layers:

1. same-market ETFs with similar benchmark, theme, geography, or asset class
2. global ETFs with similar exposure, when relevant and tradable/comparable
3. adjacent theme ETFs that can explain sector rotation or investor preference

Each ETF peer should include:

- fund name
- ticker
- market or exchange
- issuer
- region or country exposure
- benchmark or strategy
- currency
- price
- NAV, if available
- AUM or net assets
- total expense ratio
- real expense ratio, if available
- distribution yield, if available
- 1-week, 1-month, 3-month, YTD, and 1-year returns when available
- short multilingual peer analysis

ETF peer analysis must be approximately three paragraphs:

1. exposure difference versus the target ETF
2. cost, liquidity, AUM, tracking, distribution, and performance comparison
3. read-through to the target ETF's theme narrative, risk, or relative attractiveness

## News And Price Linkage Rule

`news_events` should include 8 to 12 items by default, unless the target has limited public news flow.

Every news item must include:

- date
- title
- source
- URL, when available
- related tickers
- sentiment
- impact horizon
- observed price reaction, if available
- multilingual interpretation

Allowed sentiment values:

- `positive`
- `mixed`
- `negative`
- `neutral`

Allowed impact horizons:

- `short`
- `medium`
- `long`

The price linkage must explain whether the event is:

- already priced in
- a new catalyst
- an execution-risk warning
- a one-off accounting item
- a long-term structural support

When possible, connect event dates to nearby 1-day, 5-day, and 20-day price movement. If exact event-study data is unavailable, say so plainly.

For ETF products, news events may come from:

- ETF issuer announcements and disclosures
- benchmark index methodology or rebalance announcements
- top holding company news
- sector, policy, trade, regulation, currency, and macro news linked to the ETF exposure
- peer ETF flows, fee changes, or distribution announcements

ETF news linkage must explain whether the event affects:

- ETF market price directly
- NAV through holdings
- premium or discount
- liquidity and trading volume
- tracking error
- currency translation
- theme sentiment

Do not describe every top-holding news item as a direct ETF catalyst. Weight, benchmark relevance, and market timing must be stated.

## Global Background And Recent Developments Rule

Every `full` update must include explanatory context beyond price movement. This rule applies to all markets and all asset types.

For stocks, include these sections when source coverage allows:

- `company_background`
- `business_model`
- `technology_or_product_map`
- `recent_developments`
- `investment_thesis`

For ETFs, include these sections when source coverage allows:

- `fund_background`
- `benchmark_or_strategy_background`
- `holdings_theme_map`
- `recent_developments`
- `fund_thesis`

The page should answer:

1. What is the company, fund, or listed instrument?
2. Why does the market care about it now?
3. What has changed recently?
4. How can those changes connect to price, NAV, holdings, or valuation?
5. What would strengthen or weaken the thesis?

Recent developments web search requirements:

- Search official issuer/company sources first.
- Search exchange filings, regulatory announcements, and investor-relations reports where available.
- Search reputable industry and financial news for the most recent product, technology, order, partnership, regulatory, earnings, and sector developments.
- Each development must include date, title, source, URL, relevance, confidence, and price/NAV linkage.
- If exact event-study price movement is unavailable, say so plainly.
- Do not rely only on search snippets when a primary source or full article can be opened.
- Do not treat promotional product news as confirmed financial impact unless orders, revenue, shipments, or filings support that link.

Narrative completeness validation:

- A `full` page must not be considered complete if it contains only price, chart, valuation, and generic peer data.
- If background or recent developments cannot be collected, mark `data_quality.status` as `partial` and explain the missing narrative coverage.

## Technical Analysis Rule

The updater must compute or infer:

- support zones
- resistance zones
- trend state
- risk state
- 5-day moving average
- 20-day moving average
- 60-day moving average
- 120-day moving average, if enough data exists
- RSI, if enough data exists
- volume expansion or contraction

If full calculation data is not available, the updater must use observed price zones and label the result as chart-structure analysis rather than indicator calculation.

Technical analysis integrity requirements:

- Calculate MA5 only when at least 5 valid sequential closes are available.
- Calculate MA20 only when at least 20 valid sequential closes are available.
- Calculate MA60 only when at least 60 valid sequential closes are available.
- Calculate RSI only when the required lookback window and enough sequential closes are available.
- Calculate volume expansion or contraction only when enough sequential volume observations exist.
- Do not infer RSI, moving averages, or volume trend from a single quote, 52-week high/low, or sparse reference points.
- Support and resistance must identify whether each level is `calculated`, `observed`, `52-week reference`, or `manual interpretation`.
- The renderer must avoid presenting sparse-reference charts as full historical price charts.

`technical_view.trend_state.ko/en/ja` must be written as approximately three paragraphs:

1. current trend structure and recent price movement
2. support, resistance, breakout, and invalidation zones
3. volume, momentum, and confirmation conditions

`technical_view.risk_state.ko/en/ja` may be shorter, but must clearly state the invalidation price zone and next upside confirmation zone.

For ETF products, technical analysis must distinguish:

- ETF market price trend
- NAV trend, if available
- premium or discount behavior, if available
- trading-volume and liquidity state
- benchmark or major-holdings trend, when ETF price history is too short

If the ETF is newly listed and does not have enough trading history for moving averages or RSI, the updater must clearly label the result as early chart-structure analysis and use benchmark/holdings context only as supporting evidence.

## Trading Scenario Rule

The updater must produce three scenarios:

- short term
- medium term
- long term

Each scenario must include:

- setup
- entry or observation condition
- confirmation condition
- invalidation or risk condition
- fundamental or technical basis

Each scenario body must be approximately three paragraphs:

1. main setup and price or fundamental trigger
2. execution approach, such as staged entry, confirmation, or position reduction
3. risk condition and invalidation logic

Never present scenarios as guaranteed outcomes. Use research wording, not instruction wording.

For ETF products, each scenario must include ETF-specific risk and confirmation logic:

- NAV or benchmark confirmation
- premium or discount condition
- liquidity or trading-volume condition
- fee and distribution considerations, when relevant
- currency exposure
- concentration risk from top holdings
- policy, regulation, or index-rebalance risk

ETF scenarios must not be written as if the ETF has company earnings, management guidance, operating margin, or balance-sheet catalysts.

## Static Page Rendering Rule

The generated HTML page should:

- load `latest.json`
- load the referenced raw JSON
- support language switching
- support Light Theme and Dark Theme switching
- render chart, financials, segment map, peers, news, technical view, trading scenarios, sources, and disclaimer
- show a clear error message if opened through `file://`
- degrade gracefully if a CDN chart library fails
- avoid market-specific hard-coded units in shared templates

Renderer formatting rules:

- Use a generic `formatMoney(value, currency)` helper.
- Use a generic large-number formatter that accepts both `value` and `currency`.
- Do not leave source-market formatter names such as `jpyB`, `krwT`, or `usdB` in generic pages unless they are wrapped by a currency-aware dispatcher.
- When cloning an existing page, search the new JS/CSS/HTML for old market currency strings before validation.
- Validation must fail if a page for `KRX` contains display literals like `JPY`, or if a page for `TSE` contains display literals like `KRW`, unless they appear inside peer descriptions or source text where the foreign currency is intentional.

No private API key may be embedded in client-side JavaScript.

## Theme Rendering Rule

The generated page must support both Light Theme and Dark Theme.

Theme requirements:

- Provide a visible theme toggle in the page chrome.
- Use `data-theme="light"` and `data-theme="dark"` on the document root or body.
- Respect the user's system preference through `prefers-color-scheme` on first load.
- Persist the user's explicit choice in `localStorage`.
- Avoid a flash of the wrong theme by applying the saved or preferred theme before the main page renders.
- The theme toggle must be keyboard accessible and expose an accessible label.
- Theme labels should be multilingual when visible (`ko/en/ja`).
- Charts, fallback charts, tables, badges, links, borders, focus states, and error states must be legible in both themes.
- Do not encode theme colors directly inside generated data JSON. Theme is a renderer concern.
- Use CSS custom properties for color tokens rather than duplicating full style blocks.

Minimum token set:

```css
:root {
  --color-bg: ...;
  --color-surface: ...;
  --color-text: ...;
  --color-muted: ...;
  --color-border: ...;
  --color-accent: ...;
  --color-positive: ...;
  --color-negative: ...;
  --color-warning: ...;
}
```

Validation must check both themes before the run is marked complete. The page must not rely on a single dark-only or light-only palette, and text must meet readable contrast against its background in both themes.

## Analysis Index Rule

The project may provide a static analysis index page at:

```text
https://HyangDan2.github.io/analysis.html
```

Purpose:

- Provide one simple entry point for all generated analysis pages.
- Separate analysis navigation from the root portfolio/home page.
- Let users filter stocks and ETFs without remembering nested analysis URLs.

Required files:

```text
analysis.html
analysis-index.css
analysis-index.js
analysis/manifest.json
```

The updater must not modify the root `index.html` when creating or updating the analysis index unless the user explicitly requests a root-site navigation change.

Navigation requirements:

- Root `index.html` may link to `analysis.html` only when the user explicitly requests a root-site navigation change.
- When present, the root navigation entry should use the label `Stock analysis Technology (AI-Driven)` and link to `analysis.html`.
- `analysis.html` must keep its root-site return link pointed at `index.html`; the visible label should be `About`.
- Every detail analysis page must provide a `Home` link to the analysis index:
  - from `analysis/{KEY}/{KEY}.html`, use `../../analysis.html`;
  - the `HD2Lab` brand link must remain pointed at `../../index.html`.
- Stock and ETF detail pages must use the same header structure:
  - left: `HD2Lab` brand link;
  - right controls: `Home`, Light/Dark theme toggle, and `KOR / ENG / JPN` language buttons.
- Do not create a detail analysis page that is reachable only from a deep URL and not reachable from the analysis index.
- Do not rename the detail-page `Home` link to `About`; `About` is reserved for the analysis index link back to the root page.

`analysis/manifest.json` is the source of truth for the index. GitHub Pages cannot perform server-side directory scans, so the index must use a static manifest and browser-side `fetch()`.

Manifest item example:

```json
{
  "asset_type": "etf",
  "market": "KRX",
  "ticker": "0048K0",
  "key": "KRX0048K0",
  "name": "KODEX China Humanoid Robot ETF",
  "name_ko": "KODEX 차이나휴머노이드로봇",
  "theme": "China Humanoid Robotics",
  "issuer": "Samsung Asset Management",
  "benchmark": "Solactive China Humanoid Robotics Index (CNH) (Price Return)",
  "url": "analysis/KRX0048K0/KRX0048K0.html",
  "latest_json": "analysis/KRX0048K0/latest.json"
}
```

Required manifest fields:

- `asset_type`
- `market`
- `ticker`
- `key`
- `name`
- `name_ko`
- `theme`
- `url`
- `latest_json`

Stock-specific manifest fields:

- `sector`
- `industry`

ETF-specific manifest fields:

- `issuer`
- `benchmark`

Index UI requirements:

- Show all available analysis pages.
- Provide `Stock` and `ETF` filters.
- Provide market filters, such as `KRX`, `TSE`, `NYSE`, and `NASDAQ`.
- Provide search over ticker, key, name, Korean name, theme, issuer, sector, and benchmark.
- Provide sorting by latest update date, market, asset type, and name.
- Support Light Theme and Dark Theme using the same theme rendering rules.
- Keep the index navigation consistent with the detail-page navigation rule:
  - root page -> `analysis.html` is the public entry point for the analysis library;
  - `analysis.html` -> `index.html` uses the `About` label;
  - detail pages -> `analysis.html` use the `Home` label.
- Render usable cards even when raw data fetch fails.
- Never require a backend server.

Index card enrichment:

- The index should first render cards from `analysis/manifest.json`.
- It may then fetch each item's `latest_json`, then fetch the referenced raw JSON.
- Raw JSON enrichment may display `as_of`, `price_snapshot`, `identity`, `etf_profile`, and `data_quality` summary fields.
- If `latest_json` or raw JSON fails to load, keep the card visible and show `Data unavailable` or a similar concise status.

Stock cards should prefer:

- company name
- sector or industry
- latest close and currency
- data quality status
- latest analysis date

ETF cards should prefer:

- fund name
- issuer
- benchmark or theme
- NAV or latest market price
- total fee or real expense ratio, when available
- holdings count, when available
- data quality status
- latest analysis date

Manifest update rules:

- A full target update should add or refresh the matching manifest item.
- `index_only` mode may update only `analysis/manifest.json`, `analysis.html`, `analysis-index.css`, and `analysis-index.js`.
- `holdings_only` mode should not change manifest metadata unless fund identity, holdings count, or display theme materially changes.
- Manifest entries must preserve leading zeros and non-numeric ticker characters such as `0048K0` or `0162L0`.

## GitHub Pages Rule

The updater must assume there is no backend server.

Allowed:

- static HTML
- static CSS
- static JavaScript
- static JSON
- public CDN libraries

Not allowed:

- server-only secrets
- private API keys in browser JavaScript
- runtime database writes from the page
- paid API calls directly from public client code

## Data Quality Rule

The updater must include `data_quality` with:

- `status`: `complete`, `partial`, or `failed`
- `missing_fields`
- `stale_fields`
- `notes`
- `source_confidence`

If a required data source is unavailable:

1. Keep the previous valid `latest.json` unchanged.
2. Do not overwrite a valid raw data file with partial data unless explicitly allowed.
3. Write limitations into `data_quality.notes`.
4. Prefer partial output only when the page can clearly show what is missing.

## Auditability Rule

Every numeric or factual claim should map to at least one source item.

Each source item should include:

- title
- URL
- publisher or owner
- usage purpose
- data date, when known
- access date or generated date

## Things The Updater Must Not Do

- It must not confuse tickers or companies.
- It must not confuse ETFs, ETNs, funds, preferred shares, warrants, or common stocks.
- It must not drop leading zeros in tickers such as KRX `012450`.
- It must not fabricate prices, earnings, or source names.
- It must not overwrite historical raw data files.
- It must not expose private API keys.
- It must not remove old raw data unless explicitly requested.
- It must not output only one language for user-facing analysis when the requested language set has multiple languages.
- It must not use a fixed peer list for every company.
- It must not treat all news as direct catalysts.
- It must not generate issuer company financials as ETF fundamentals.
- It must not ship a page that is readable in only Light Theme or only Dark Theme.
- It must not regenerate full analysis text during `holdings_only` mode unless explicitly requested.
- It must not hide a valid analysis page from `analysis/manifest.json` when creating or updating the analysis index.
- It must not let stock pages and ETF pages drift into incompatible header/navigation structures.

## Recommended Run Order

1. Normalize `market + ticker`.
2. Determine `update_mode`; default to `full`.
3. Build `{MARKET}{TICKER}` output paths.
4. Verify target identity and asset type.
5. Branch by update mode:
   - `full`: run the full stock or ETF update flow.
   - `holdings_only`: run the Holdings-Only Update Rule and skip full analysis generation.
   - `price_only`: refresh only price, chart, and technical fields when supported.
   - `index_only`: update only the analysis index and manifest.
6. For `full`, fetch latest market date and price snapshot.
7. For `full`, fetch recent chart data.
8. For `full`, branch by asset type:
   - For stocks, fetch latest official financials, build business segment map, and build company peer groups.
   - For ETFs, fetch ETF profile, NAV, fees, distributions, holdings, benchmark, tracking data, and ETF peer groups.
9. For `full`, fetch recent company, ETF, sector, benchmark, holdings, and macro news as appropriate for the asset type.
10. For `full`, link news to price, NAV, holdings, benchmark, or theme movement where possible.
11. For `full`, generate multilingual stock or ETF analysis, technical view, and scenarios.
12. Validate JSON schema and asset-type-specific required fields.
13. Validate currency, unit, source, auditability, and update-mode constraints.
14. Validate navigation paths:
   - root `index.html` entry to `analysis.html`, when requested;
   - `analysis.html` `About` link to `index.html`;
   - every detail page `Home` link to `../../analysis.html`;
   - every detail page brand link to `../../index.html`.
15. Validate Light Theme and Dark Theme rendering when HTML/CSS/JS changes.
16. Write timestamped raw data when the update mode changes target data.
17. Update `latest.json` only after successful validation.
18. Update `analysis/manifest.json` when a full target update creates or materially changes a page.
19. Optionally update or generate the static HTML/CSS/JS page.
20. Optionally commit and push.

## Backward Compatibility Notes

The existing page:

```text
analysis/TSE7013/TSE7013.html
```

may continue to use:

- `target`
- `segment_sector_map`
- `ihi_relevance`
- `ihi_linkage`

New generic pages should prefer:

- `identity`
- `business_segment_map`
- `company_relevance`
- `segment_linkage`

The updater may emit both old and new keys during a transition period.

## Shared favicon

Every generated analysis HTML page must include the shared Web-HQ favicon in its head:

```html
<link rel="icon" type="image/svg+xml" href="../../assets/favicon.svg">
```

This path applies to `analysis/<ticker>/<ticker>.html`. Root pages such as `analysis.html` use `assets/favicon.svg`. Keep the icon at the repository root; do not create per-page copies.
