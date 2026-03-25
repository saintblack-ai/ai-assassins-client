import { getNews } from "../api/news";

function createAlert(level, title, message, source, metadata = {}) {
  return {
    id: `${source}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${metadata.index ?? 0}`,
    level,
    title,
    message,
    source,
    createdAt: new Date().toISOString(),
    metadata
  };
}

function classifyHeadline(title) {
  const normalized = String(title || "").toLowerCase();
  const riskTerms = ["war", "conflict", "strike", "attack", "sanction", "cyber", "missile", "crisis"];

  const matched = riskTerms.filter((term) => normalized.includes(term));
  if (matched.length >= 2) {
    return "high";
  }
  if (matched.length === 1) {
    return "medium";
  }
  return "normal";
}

function analyzeTrend(items) {
  const risky = items.filter((item) => classifyHeadline(item.title) !== "normal").length;
  if (risky >= 3) {
    return "escalating";
  }
  if (risky >= 1) {
    return "watch";
  }
  return "stable";
}

function detectAnomalies(items) {
  return items.map((item, index) => {
    const level = classifyHeadline(item.title);
    const source = "news-agent";

    if (level === "high") {
      return createAlert(
        "high",
        "Escalatory headline cluster",
        `${item.title} contains multiple risk markers and may signal rapidly changing conditions.`,
        source,
        { index, headline: item.title }
      );
    }

    if (level === "medium") {
      return createAlert(
        "medium",
        "Watchlist headline detected",
        `${item.title} includes one conflict or disruption marker and should remain on watch.`,
        source,
        { index, headline: item.title }
      );
    }

    return createAlert(
      "normal",
      "Headline flow normal",
      `${item.title} does not cross the current escalation threshold.`,
      source,
      { index, headline: item.title }
    );
  });
}

export async function newsAgent() {
  const data = await getNews();
  const alerts = detectAnomalies(data.items || []);
  const error = data.error || null;
  const status = error ? "error" : data.live ? "live" : "fallback";

  return {
    name: "news-agent",
    data,
    status,
    error,
    trend: analyzeTrend(data.items || []),
    anomalies: alerts.filter((alert) => alert.level !== "normal"),
    alerts
  };
}
