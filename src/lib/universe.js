/* ============================================================
   DIONE · universe.js — Universo curado Tier 1
   131 tickers. Máximo que el free tier de Finnhub soporta en
   un scan on-demand con caché de 24h.
   ============================================================ */

export const UNIVERSE = [
  // ── ETF (14) ───────────────────────────────────────────────
  { ticker: "SPY",   sector: "ETF",           cap: "etf",   name: "S&P 500" },
  { ticker: "QQQ",   sector: "ETF",           cap: "etf",   name: "Nasdaq 100" },
  { ticker: "IWM",   sector: "ETF",           cap: "etf",   name: "Russell 2000" },
  { ticker: "VWO",   sector: "ETF",           cap: "etf",   name: "Emerging Markets" },
  { ticker: "EWZ",   sector: "ETF",           cap: "etf",   name: "Brasil" },
  { ticker: "GLD",   sector: "ETF",           cap: "etf",   name: "Gold" },
  { ticker: "SLV",   sector: "ETF",           cap: "etf",   name: "Plata" },
  { ticker: "TLT",   sector: "ETF",           cap: "etf",   name: "Treasury 20Y" },
  { ticker: "HYG",   sector: "ETF",           cap: "etf",   name: "High Yield" },
  { ticker: "SOXX",  sector: "ETF",           cap: "etf",   name: "Semiconductores" },
  { ticker: "ITA",   sector: "ETF",           cap: "etf",   name: "Defensa & Aero." },
  { ticker: "INDA",  sector: "ETF",           cap: "etf",   name: "India" },
  { ticker: "EWJ",   sector: "ETF",           cap: "etf",   name: "Japón" },
  { ticker: "ARKK",  sector: "ETF",           cap: "etf",   name: "ARK Innovation" },

  // ── Technology — Large Cap (10) ────────────────────────────
  { ticker: "AAPL",  sector: "Technology",    cap: "large", name: "Apple" },
  { ticker: "MSFT",  sector: "Technology",    cap: "large", name: "Microsoft" },
  { ticker: "NVDA",  sector: "Technology",    cap: "large", name: "NVIDIA" },
  { ticker: "GOOGL", sector: "Technology",    cap: "large", name: "Alphabet" },
  { ticker: "META",  sector: "Technology",    cap: "large", name: "Meta" },
  { ticker: "AVGO",  sector: "Technology",    cap: "large", name: "Broadcom" },
  { ticker: "ORCL",  sector: "Technology",    cap: "large", name: "Oracle" },
  { ticker: "CRM",   sector: "Technology",    cap: "large", name: "Salesforce" },
  { ticker: "ADBE",  sector: "Technology",    cap: "large", name: "Adobe" },
  { ticker: "AMD",   sector: "Technology",    cap: "large", name: "AMD" },

  // ── Semiconductors (7) ─────────────────────────────────────
  { ticker: "TSM",   sector: "Technology",    cap: "large", name: "TSMC" },
  { ticker: "ASML",  sector: "Technology",    cap: "large", name: "ASML" },
  { ticker: "ARM",   sector: "Technology",    cap: "large", name: "Arm Holdings" },
  { ticker: "MU",    sector: "Technology",    cap: "large", name: "Micron" },
  { ticker: "QCOM",  sector: "Technology",    cap: "large", name: "Qualcomm" },
  { ticker: "INTC",  sector: "Technology",    cap: "large", name: "Intel" },
  { ticker: "DELL",  sector: "Technology",    cap: "large", name: "Dell Technologies" },

  // ── Technology — Mid / Growth (11) ────────────────────────
  { ticker: "SHOP",  sector: "Technology",    cap: "large", name: "Shopify" },
  { ticker: "PLTR",  sector: "Technology",    cap: "large", name: "Palantir" },
  { ticker: "UBER",  sector: "Technology",    cap: "large", name: "Uber" },
  { ticker: "COIN",  sector: "Technology",    cap: "large", name: "Coinbase" },
  { ticker: "NET",   sector: "Technology",    cap: "large", name: "Cloudflare" },
  { ticker: "DDOG",  sector: "Technology",    cap: "large", name: "Datadog" },
  { ticker: "CRWD",  sector: "Technology",    cap: "large", name: "CrowdStrike" },
  { ticker: "SMCI",  sector: "Technology",    cap: "large", name: "Super Micro" },
  { ticker: "HUBS",  sector: "Technology",    cap: "large", name: "HubSpot" },
  { ticker: "SNOW",  sector: "Technology",    cap: "mid",   name: "Snowflake" },
  { ticker: "PATH",  sector: "Technology",    cap: "mid",   name: "UiPath" },

  // ── Cybersecurity (3) ──────────────────────────────────────
  { ticker: "PANW",  sector: "Technology",    cap: "large", name: "Palo Alto Networks" },
  { ticker: "ZS",    sector: "Technology",    cap: "large", name: "Zscaler" },
  { ticker: "S",     sector: "Technology",    cap: "mid",   name: "SentinelOne" },

  // ── Consumer Discretionary (8) ────────────────────────────
  { ticker: "AMZN",  sector: "Cons. Disc.",   cap: "large", name: "Amazon" },
  { ticker: "TSLA",  sector: "Cons. Disc.",   cap: "large", name: "Tesla" },
  { ticker: "NKE",   sector: "Cons. Disc.",   cap: "large", name: "Nike" },
  { ticker: "SBUX",  sector: "Cons. Disc.",   cap: "large", name: "Starbucks" },
  { ticker: "MCD",   sector: "Cons. Disc.",   cap: "large", name: "McDonald's" },
  { ticker: "LULU",  sector: "Cons. Disc.",   cap: "large", name: "Lululemon" },
  { ticker: "BKNG",  sector: "Cons. Disc.",   cap: "large", name: "Booking Holdings" },
  { ticker: "ROKU",  sector: "Cons. Disc.",   cap: "mid",   name: "Roku" },

  // ── Consumer Staples (5) ──────────────────────────────────
  { ticker: "COST",  sector: "Cons. Staples", cap: "large", name: "Costco" },
  { ticker: "WMT",   sector: "Cons. Staples", cap: "large", name: "Walmart" },
  { ticker: "PG",    sector: "Cons. Staples", cap: "large", name: "P&G" },
  { ticker: "KO",    sector: "Cons. Staples", cap: "large", name: "Coca-Cola" },
  { ticker: "PEP",   sector: "Cons. Staples", cap: "large", name: "PepsiCo" },

  // ── Financials (12) ───────────────────────────────────────
  { ticker: "JPM",   sector: "Financials",    cap: "large", name: "JPMorgan" },
  { ticker: "BAC",   sector: "Financials",    cap: "large", name: "Bank of America" },
  { ticker: "GS",    sector: "Financials",    cap: "large", name: "Goldman Sachs" },
  { ticker: "MS",    sector: "Financials",    cap: "large", name: "Morgan Stanley" },
  { ticker: "V",     sector: "Financials",    cap: "large", name: "Visa" },
  { ticker: "MA",    sector: "Financials",    cap: "large", name: "Mastercard" },
  { ticker: "AXP",   sector: "Financials",    cap: "large", name: "American Express" },
  { ticker: "BRK.B", sector: "Financials",    cap: "large", name: "Berkshire B" },
  { ticker: "NU",    sector: "Financials",    cap: "large", name: "Nu Holdings" },
  { ticker: "SOFI",  sector: "Financials",    cap: "mid",   name: "SoFi" },
  { ticker: "HOOD",  sector: "Financials",    cap: "mid",   name: "Robinhood" },
  { ticker: "MSTR",  sector: "Financials",    cap: "large", name: "MicroStrategy (BTC proxy)" },

  // ── Healthcare (9) ────────────────────────────────────────
  { ticker: "UNH",   sector: "Healthcare",    cap: "large", name: "UnitedHealth" },
  { ticker: "LLY",   sector: "Healthcare",    cap: "large", name: "Eli Lilly" },
  { ticker: "NVO",   sector: "Healthcare",    cap: "large", name: "Novo Nordisk (GLP-1)" },
  { ticker: "ABBV",  sector: "Healthcare",    cap: "large", name: "AbbVie" },
  { ticker: "JNJ",   sector: "Healthcare",    cap: "large", name: "J&J" },
  { ticker: "MRK",   sector: "Healthcare",    cap: "large", name: "Merck" },
  { ticker: "AMGN",  sector: "Healthcare",    cap: "large", name: "Amgen" },
  { ticker: "ISRG",  sector: "Healthcare",    cap: "large", name: "Intuitive Surgical" },
  { ticker: "MRNA",  sector: "Healthcare",    cap: "mid",   name: "Moderna" },

  // ── Energy (5) ────────────────────────────────────────────
  { ticker: "XOM",   sector: "Energy",        cap: "large", name: "ExxonMobil" },
  { ticker: "CVX",   sector: "Energy",        cap: "large", name: "Chevron" },
  { ticker: "COP",   sector: "Energy",        cap: "large", name: "ConocoPhillips" },
  { ticker: "SLB",   sector: "Energy",        cap: "large", name: "SLB" },
  { ticker: "PBR",   sector: "Energy",        cap: "large", name: "Petrobras" },

  // ── Utilities / Nuclear — trend AI power demand (5) ───────
  { ticker: "NEE",   sector: "Utilities",     cap: "large", name: "NextEra Energy" },
  { ticker: "CEG",   sector: "Utilities",     cap: "large", name: "Constellation Energy" },
  { ticker: "VST",   sector: "Utilities",     cap: "large", name: "Vistra Energy" },
  { ticker: "OXY",   sector: "Energy",        cap: "large", name: "Occidental" },
  { ticker: "OKLO",  sector: "Utilities",     cap: "small", name: "Oklo (nuclear SMR)" },

  // ── Industrials / Defense (10) ────────────────────────────
  { ticker: "CAT",   sector: "Industrials",   cap: "large", name: "Caterpillar" },
  { ticker: "HON",   sector: "Industrials",   cap: "large", name: "Honeywell" },
  { ticker: "BA",    sector: "Industrials",   cap: "large", name: "Boeing" },
  { ticker: "GE",    sector: "Industrials",   cap: "large", name: "GE Aerospace" },
  { ticker: "RTX",   sector: "Industrials",   cap: "large", name: "Raytheon" },
  { ticker: "LMT",   sector: "Industrials",   cap: "large", name: "Lockheed Martin" },
  { ticker: "NOC",   sector: "Industrials",   cap: "large", name: "Northrop Grumman" },
  { ticker: "GD",    sector: "Industrials",   cap: "large", name: "General Dynamics" },
  { ticker: "AXON",  sector: "Industrials",   cap: "large", name: "Axon Enterprise" },
  { ticker: "RKLB",  sector: "Industrials",   cap: "small", name: "Rocket Lab" },

  // ── Materials (4) ─────────────────────────────────────────
  { ticker: "FCX",   sector: "Materials",     cap: "large", name: "Freeport-McMoRan" },
  { ticker: "NEM",   sector: "Materials",     cap: "large", name: "Newmont" },
  { ticker: "GOLD",  sector: "Materials",     cap: "large", name: "Barrick Gold" },
  { ticker: "VALE",  sector: "Materials",     cap: "large", name: "Vale" },

  // ── Real Estate (3) ───────────────────────────────────────
  { ticker: "PLD",   sector: "Real Estate",   cap: "large", name: "Prologis" },
  { ticker: "AMT",   sector: "Real Estate",   cap: "large", name: "American Tower" },
  { ticker: "SPG",   sector: "Real Estate",   cap: "large", name: "Simon Property" },

  // ── Communication (3) ─────────────────────────────────────
  { ticker: "NFLX",  sector: "Communication", cap: "large", name: "Netflix" },
  { ticker: "DIS",   sector: "Communication", cap: "large", name: "Disney" },
  { ticker: "SPOT",  sector: "Communication", cap: "mid",   name: "Spotify" },

  // ── EM / LatAm (13) ───────────────────────────────────────
  { ticker: "MELI",  sector: "EM / LatAm",    cap: "large", name: "MercadoLibre" },
  { ticker: "GLOB",  sector: "EM / LatAm",    cap: "mid",   name: "Globant" },
  { ticker: "PDD",   sector: "EM / LatAm",    cap: "large", name: "PDD Holdings" },
  { ticker: "BIDU",  sector: "EM / LatAm",    cap: "large", name: "Baidu" },
  { ticker: "BABA",  sector: "EM / LatAm",    cap: "large", name: "Alibaba" },
  { ticker: "SE",    sector: "EM / LatAm",    cap: "large", name: "Sea Limited" },
  { ticker: "GRAB",  sector: "EM / LatAm",    cap: "mid",   name: "Grab Holdings" },
  { ticker: "ITUB",  sector: "EM / LatAm",    cap: "large", name: "Itaú Unibanco" },
  { ticker: "ABEV",  sector: "EM / LatAm",    cap: "large", name: "Ambev" },
  { ticker: "PAGS",  sector: "EM / LatAm",    cap: "mid",   name: "PagSeguro" },
  { ticker: "STNE",  sector: "EM / LatAm",    cap: "mid",   name: "StoneCo" },
  { ticker: "GGB",   sector: "EM / LatAm",    cap: "mid",   name: "Gerdau" },
  { ticker: "GFI",   sector: "EM / LatAm",    cap: "mid",   name: "Gold Fields (ZA)" },
];

// Sectores únicos para filtros
export const SECTORS = ["all", ...new Set(UNIVERSE.map((u) => u.sector))];

// Caps disponibles
export const CAPS = ["large", "mid", "small", "etf"];
