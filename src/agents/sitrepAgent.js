import { getSitrep } from "../api/sitrep";

function createAlert(level, title, message, source, metadata = {}) {
  return {
    id: `${source}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${metadata.region || "x"}`,
    level,
    title,
    message,
    source,
    createdAt: new Date().toISOString(),
    metadata
  };
}

function severityScore(severity) {
  if (severity === "Critical") {
    return 3;
  }
  if (severity === "High") {
    return 2;
  }
  if (severity === "Medium") {
    return 1;
  }
  return 0;
}

function analyzeTrend(items) {
  const escalated = items.filter((item) => severityScore(item.severity) >= 2).length;
  if (escalated >= 3) {
    return "escalating";
  }
  if (escalated >= 1) {
    return "contested";
  }
  return "contained";
}

function detectAnomalies(items) {
  const escalated = items.filter((item) => severityScore(item.severity) >= 2);
  const alerts = items.map((item) => {
    const level =
      item.severity === "Critical" || item.severity === "High"
        ? "high"
        : item.severity === "Medium"
          ? "medium"
          : "normal";

    return createAlert(
      level,
      `${item.region} SITREP`,
      `${item.region} is reporting ${item.incidents} alerts with ${item.severity.toLowerCase()} severity.`,
      "sitrep-agent",
      { region: item.region, severity: item.severity, incidents: item.incidents }
    );
  });

  if (escalated.length >= 2) {
    alerts.unshift(
      createAlert(
        "high",
        "Multi-region conflict escalation",
        `${escalated.length} regions are simultaneously reporting high-severity conflict activity.`,
        "sitrep-agent",
        { regions: escalated.map((item) => item.region) }
      )
    );
  }

  return alerts;
}

export async function sitrepAgent() {
  const data = await getSitrep();
  const alerts = detectAnomalies(data.items || []);
  const error = data.error || null;
  const status = error ? "error" : data.live ? "live" : "fallback";

  return {
    name: "sitrep-agent",
    data,
    status,
    error,
    trend: analyzeTrend(data.items || []),
    anomalies: alerts.filter((alert) => alert.level !== "normal"),
    alerts
  };
}
