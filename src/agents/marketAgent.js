import { getStocks } from "../api/stocks";

function createAlert(level, title, message, source, metadata = {}) {
  return {
    id: `${source}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    level,
    title,
    message,
    source,
    createdAt: new Date().toISOString(),
    metadata
  };
}

function analyzeTrend(items) {
  const falling = items.filter((item) => item.changePercent < 0).length;
  const rising = items.filter((item) => item.changePercent > 0).length;

  if (falling > rising) {
    return "risk-off";
  }
  if (rising > falling) {
    return "risk-on";
  }
  return "mixed";
}

function detectAnomalies(items) {
  const alerts = [];

  items.forEach((item) => {
    if (item.symbol === "BTC" && item.changePercent <= -5) {
      alerts.push(
        createAlert(
          "high",
          "BTC drawdown detected",
          `Bitcoin has dropped ${item.changePercent.toFixed(2)}%, exceeding the -5% alert threshold.`,
          "market-agent",
          { symbol: item.symbol, changePercent: item.changePercent }
        )
      );
      return;
    }

    if (Math.abs(item.changePercent) >= 3) {
      alerts.push(
        createAlert(
          "medium",
          `${item.symbol} volatility spike`,
          `${item.label} is moving ${item.changePercent.toFixed(2)}%, which exceeds the medium-volatility threshold.`,
          "market-agent",
          { symbol: item.symbol, changePercent: item.changePercent }
        )
      );
      return;
    }

    alerts.push(
      createAlert(
        "normal",
        `${item.symbol} within normal range`,
        `${item.label} is stable at ${item.changePercent.toFixed(2)}% change.`,
        "market-agent",
        { symbol: item.symbol, changePercent: item.changePercent }
      )
    );
  });

  return alerts;
}

export async function marketAgent() {
  const data = await getStocks();
  const alerts = detectAnomalies(data.items || []);
  const error = data.error || null;
  const status = error ? "error" : data.live ? "live" : "fallback";

  return {
    name: "market-agent",
    data,
    status,
    error,
    trend: analyzeTrend(data.items || []),
    anomalies: alerts.filter((alert) => alert.level !== "normal"),
    alerts
  };
}
