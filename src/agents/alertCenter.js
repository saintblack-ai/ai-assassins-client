import { marketAgent } from "./marketAgent";
import { newsAgent } from "./newsAgent";
import { sitrepAgent } from "./sitrepAgent";
import { saveAlerts, sendAlertsWebhook } from "../lib/alertsRepository";

function levelWeight(level) {
  if (level === "high") {
    return 3;
  }
  if (level === "medium") {
    return 2;
  }
  return 1;
}

function systemLevel(alerts) {
  if (alerts.some((alert) => alert.level === "high")) {
    return "high";
  }
  if (alerts.some((alert) => alert.level === "medium")) {
    return "medium";
  }
  return "normal";
}

export function buildPushNotificationPayload(alerts) {
  const topAlerts = [...alerts]
    .sort((left, right) => levelWeight(right.level) - levelWeight(left.level))
    .slice(0, 3);

  return {
    title: "ARCHAIOS Alert Update",
    body: topAlerts.map((alert) => alert.title).join(" | "),
    alerts: topAlerts,
    channel: "archaios-alert-feed",
    mobileReady: true
  };
}

export async function runIntelligenceAgents(context = {}) {
  const [market, sitrep, news] = await Promise.all([marketAgent(), sitrepAgent(), newsAgent()]);
  const alerts = [...market.alerts, ...sitrep.alerts, ...news.alerts].sort(
    (left, right) => levelWeight(right.level) - levelWeight(left.level)
  );
  const [persistence, webhook] = await Promise.all([
    saveAlerts(alerts, context.userId),
    sendAlertsWebhook(alerts, context)
  ]);

  return {
    market,
    sitrep,
    news,
    alerts,
    history: [],
    persistence,
    webhook,
    systemLevel: systemLevel(alerts),
    notificationPayload: buildPushNotificationPayload(alerts),
    generatedAt: new Date().toISOString()
  };
}
