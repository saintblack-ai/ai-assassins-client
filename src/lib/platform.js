import { isSupabaseEnabled, supabase } from "./supabase";

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? "" : "http://localhost:5000")).replace(/\/+$/, "");

export function hasPaidAccess(tier) {
  return tier === "pro" || tier === "elite";
}

export async function getCurrentSession() {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session;
}

export function subscribeToAuthChanges(callback) {
  if (!isSupabaseEnabled || !supabase) {
    return { data: { subscription: { unsubscribe() {} } } };
  }

  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signIn(email, password) {
  if (!supabase) {
    throw new Error("Supabase auth is not configured");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
}

export async function signUp(email, password) {
  if (!supabase) {
    throw new Error("Supabase auth is not configured");
  }

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw error;
  }
}

export async function signOut() {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}

export async function getUserTier(userId) {
  if (!supabase || !userId) {
    return "free";
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("tier,status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return "free";
  }

  if (data.status === "active" || data.status === "trialing") {
    if (data.tier === "pro" || data.tier === "elite") {
      return data.tier;
    }
  }

  return "free";
}

async function apiFetch(path, accessToken, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `request_failed_${response.status}`);
  }

  return payload;
}

export async function fetchUserAlerts(accessToken) {
  return apiFetch("/api/alerts", accessToken, { method: "GET" });
}

export async function clearUserAlerts(accessToken) {
  return apiFetch("/api/alerts", accessToken, { method: "DELETE" });
}

export async function createCheckoutSession(accessToken, tier) {
  return apiFetch("/api/stripe/checkout", accessToken, {
    method: "POST",
    body: JSON.stringify({ tier })
  });
}

export async function fetchSubscription(accessToken) {
  return apiFetch("/api/subscription", accessToken, { method: "GET" });
}

export async function fetchPlatformDashboard(accessToken) {
  return apiFetch("/api/platform/dashboard", accessToken, { method: "GET" });
}

export async function captureLead(email) {
  return apiFetch("/api/leads", null, {
    method: "POST",
    body: JSON.stringify({
      email,
      source: "ai-assassins-dashboard"
    })
  });
}

export async function logCtaClick(cta, location, tier = "free") {
  return apiFetch("/api/cta-click", null, {
    method: "POST",
    body: JSON.stringify({
      cta,
      location,
      tier
    })
  });
}
