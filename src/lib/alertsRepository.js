import { isSupabaseEnabled, supabase } from "./supabase";

const ALERTS_TABLE = "alerts";
const WEBHOOK_URL = import.meta.env.VITE_ALERT_WEBHOOK_URL;
const WEBHOOK_TOKEN = import.meta.env.VITE_ALERT_WEBHOOK_TOKEN;

function toRecord(alert, userId) {
  return {
    user_id: userId,
    type: alert.source || "system",
    severity: alert.level || "normal",
    message: `${alert.title}: ${alert.message}`,
    timestamp: alert.createdAt || new Date().toISOString()
  };
}

function toHistoryItem(row) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    message: row.message,
    timestamp: row.timestamp
  };
}

function dedupeAlerts(alerts) {
  const seen = new Set();
  return alerts.filter((alert) => {
    const key = `${alert.source}|${alert.level}|${alert.title}|${alert.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function saveAlerts(alerts, userId) {
  if (!isSupabaseEnabled || !supabase || !userId || !Array.isArray(alerts) || alerts.length === 0) {
    return {
      saved: 0,
      enabled: false
    };
  }

  const uniqueAlerts = dedupeAlerts(alerts);

  const { data, error } = await supabase
    .from(ALERTS_TABLE)
    .insert(uniqueAlerts.map((alert) => toRecord(alert, userId)))
    .select("id");

  if (error) {
    return {
      saved: 0,
      enabled: true,
      error: error.message
    };
  }

  return {
    saved: data?.length || 0,
    enabled: true
  };
}

export async function getAlertHistory(limit = 50, userId) {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  let query = supabase
    .from(ALERTS_TABLE)
    .select("id,type,severity,message,timestamp")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data || []).map(toHistoryItem);
}

export async function clearAlerts(userId) {
  if (!isSupabaseEnabled || !supabase || !userId) {
    return {
      cleared: 0,
      enabled: false
    };
  }

  const { error } = await supabase.from(ALERTS_TABLE).delete().eq("user_id", userId);

  if (error) {
    return {
      cleared: 0,
      enabled: true,
      error: error.message
    };
  }

  return {
    cleared: true,
    enabled: true
  };
}

export async function sendAlertsWebhook(alerts, context = {}) {
  const highValueAlerts = (alerts || []).filter((alert) => alert.level === "high" || alert.level === "medium");

  if (!WEBHOOK_URL || highValueAlerts.length === 0) {
    return {
      sent: 0,
      enabled: false
    };
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WEBHOOK_TOKEN ? { Authorization: `Bearer ${WEBHOOK_TOKEN}` } : {})
      },
      body: JSON.stringify({
        source: "ARCHAIOS",
        user_id: context.userId || null,
        tier: context.tier || "free",
        alerts: highValueAlerts.map((alert) => ({
          type: alert.source,
          severity: alert.level,
          title: alert.title,
          message: alert.message,
          timestamp: alert.createdAt
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`webhook_http_${response.status}`);
    }

    return {
      sent: highValueAlerts.length,
      enabled: true
    };
  } catch (error) {
    return {
      sent: 0,
      enabled: true,
      error: error instanceof Error ? error.message : "webhook_failed"
    };
  }
}
