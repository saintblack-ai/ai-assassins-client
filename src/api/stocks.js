const ALPHA_VANTAGE_API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";

const STOCK_TARGETS = [
  { id: "TSLA", symbol: "TSLA", label: "Tesla", kind: "equity" },
  { id: "NVDA", symbol: "NVDA", label: "NVIDIA", kind: "equity" },
  { id: "BTC", symbol: "BTC", label: "Bitcoin", kind: "crypto" }
];

const STOCK_MOCKS = [
  {
    id: "TSLA",
    label: "Tesla",
    symbol: "TSLA",
    price: 208.14,
    changePercent: 1.84,
    trend: "up"
  },
  {
    id: "NVDA",
    label: "NVIDIA",
    symbol: "NVDA",
    price: 941.52,
    changePercent: 2.47,
    trend: "up"
  },
  {
    id: "BTC",
    label: "Bitcoin",
    symbol: "BTC",
    price: 67284.11,
    changePercent: -0.61,
    trend: "down"
  }
];

async function fetchAlphaVantageJson(params) {
  const url = new URL(ALPHA_VANTAGE_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`alpha_vantage_http_${response.status}`);
  }

  const payload = await response.json();
  if (payload.Note || payload.Information) {
    throw new Error("alpha_vantage_rate_limit");
  }

  return payload;
}

async function fetchStockQuote(target) {
  if (target.kind === "crypto") {
    const payload = await fetchAlphaVantageJson({
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: target.symbol,
      to_currency: "USD",
      apikey: ALPHA_VANTAGE_API_KEY
    });

    const rate = payload?.["Realtime Currency Exchange Rate"];
    const price = Number(rate?.["5. Exchange Rate"] || 0);
    const bid = Number(rate?.["8. Bid Price"] || 0);
    const ask = Number(rate?.["9. Ask Price"] || 0);
    const changePercent = bid && ask ? ((ask - bid) / bid) * 100 : 0;

    return {
      id: target.id,
      label: target.label,
      symbol: target.symbol,
      price,
      changePercent,
      trend: changePercent >= 0 ? "up" : "down"
    };
  }

  const payload = await fetchAlphaVantageJson({
    function: "GLOBAL_QUOTE",
    symbol: target.symbol,
    apikey: ALPHA_VANTAGE_API_KEY
  });

  const quote = payload?.["Global Quote"];
  const price = Number(quote?.["05. price"] || 0);
  const changePercent = Number(String(quote?.["10. change percent"] || "0").replace("%", ""));

  return {
    id: target.id,
    label: target.label,
    symbol: target.symbol,
    price,
    changePercent,
    trend: changePercent >= 0 ? "up" : "down"
  };
}

export async function getStocks() {
  if (!ALPHA_VANTAGE_API_KEY) {
    return {
      live: false,
      source: "mock",
      fetchedAt: new Date().toISOString(),
      items: STOCK_MOCKS
    };
  }

  try {
    const items = await Promise.all(STOCK_TARGETS.map(fetchStockQuote));
    return {
      live: true,
      source: "alpha-vantage",
      fetchedAt: new Date().toISOString(),
      items
    };
  } catch (error) {
    return {
      live: false,
      source: "mock",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "stocks_fetch_failed",
      items: STOCK_MOCKS
    };
  }
}
