const DEFAULT_DASHBOARD_SIGNALS_PATH = "/api/internal/cron/dashboard-signals";
const DEFAULT_ACTIVITY_FEED_PATH = "/api/internal/cron/activity-feed";
const DEFAULT_METRICS_SNAPSHOTS_PATH = "/api/internal/cron/metrics-snapshots";
const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_SUPABASE_TIMEOUT_MS = 15000;
const DEFAULT_STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function createJsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function logEvent(level, event, context = {}) {
  const logger = level === "error" ? console.error : console.log;
  logger(JSON.stringify({ level, event, ...context }));
}

function buildHealthPayload(env) {
  return {
    ok: true,
    service: "archaios-daily-automation",
    backendBaseUrlConfigured: Boolean(normalizeBaseUrl(env.BACKEND_BASE_URL)),
    cron: env.CRON_SCHEDULE || "17 13 * * *",
    jobs: buildJobDefinitions(env).map((job) => ({ key: job.key, path: job.path }))
  };
}

function createCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "Content-Type, Authorization",
    "access-control-allow-methods": "GET, POST, OPTIONS"
  };
}

function createOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: createCorsHeaders()
  });
}

function maskIdentifier(value) {
  const normalized = String(value || "");
  if (!normalized) {
    return "";
  }

  if (normalized.length <= 8) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  return atob(`${normalized}${padding}`);
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) {
      return null;
    }

    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

function getAuthenticatedUserContext(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return { userId: "", email: "" };
  }

  const payload = decodeJwtPayload(authorization.slice("Bearer ".length));
  return {
    userId: String(payload?.sub || ""),
    email: String(payload?.email || "")
  };
}

function timingSafeEqual(left, right) {
  const leftValue = String(left || "");
  const rightValue = String(right || "");

  if (leftValue.length !== rightValue.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < leftValue.length; index += 1) {
    result |= leftValue.charCodeAt(index) ^ rightValue.charCodeAt(index);
  }

  return result === 0;
}

async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));

  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function parseStripeSignatureHeader(header) {
  return String(header || "")
    .split(",")
    .map((part) => part.trim())
    .reduce(
      (accumulator, part) => {
        const [key, value] = part.split("=");
        if (!key || !value) {
          return accumulator;
        }

        if (key === "t") {
          accumulator.timestamp = value;
        }

        if (key === "v1") {
          accumulator.signatures.push(value);
        }

        return accumulator;
      },
      { timestamp: "", signatures: [] }
    );
}

async function verifyStripeSignature(request, rawBody, env) {
  const webhookSecret = String(env.STRIPE_WEBHOOK_SECRET || "");
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  const parsed = parseStripeSignatureHeader(request.headers.get("stripe-signature"));
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    throw new Error("Missing Stripe signature");
  }

  const timestampSeconds = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    throw new Error("Invalid Stripe signature timestamp");
  }

  const toleranceSeconds = Number(env.STRIPE_WEBHOOK_TOLERANCE_SECONDS || DEFAULT_STRIPE_WEBHOOK_TOLERANCE_SECONDS);
  const currentSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(currentSeconds - timestampSeconds) > toleranceSeconds) {
    throw new Error("Stripe signature timestamp outside tolerance");
  }

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const expectedSignature = await hmacSha256Hex(webhookSecret, signedPayload);
  const valid = parsed.signatures.some((signature) => timingSafeEqual(signature, expectedSignature));

  if (!valid) {
    throw new Error("Invalid Stripe signature");
  }
}

function getSupabaseConfig(env) {
  return {
    url: normalizeBaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY || "")
  };
}

async function supabaseRequest(env, path, options = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role configuration is incomplete.");
  }

  const controller = new AbortController();
  const timeoutMs = Number(env.SUPABASE_REQUEST_TIMEOUT_MS || DEFAULT_SUPABASE_TIMEOUT_MS);
  const timeoutId = setTimeout(() => controller.abort("supabase_timeout"), timeoutMs);

  try {
    const response = await fetch(`${url}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        ...(options.method && options.method !== "GET" ? { "content-type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `supabase_http_${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeSubscriptionRecord(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function extractWebhookMetadata(object = {}) {
  const metadata = object.metadata || {};

  return {
    userId: String(metadata.user_id || metadata.userId || object.client_reference_id || "")
  };
}

function buildSubscriptionRecordFromCheckoutSession(session) {
  const metadata = extractWebhookMetadata(session);
  const status =
    session.payment_status === "paid" || session.status === "complete" ? "active" : "incomplete";

  return normalizeSubscriptionRecord({
    user_id: metadata.userId,
    plan: "pro",
    status,
    updated_at: new Date().toISOString()
  });
}

function buildSubscriptionRecordFromSubscription(subscription) {
  const metadata = extractWebhookMetadata(subscription);

  return normalizeSubscriptionRecord({
    user_id: metadata.userId,
    plan: "pro",
    status: String(subscription.status || "active"),
    updated_at: new Date().toISOString()
  });
}

async function findExistingSubscription(env, record) {
  if (record.user_id) {
    const byUser = await supabaseRequest(
      env,
      `/rest/v1/subscriptions?select=id,user_id&user_id=eq.${encodeURIComponent(record.user_id)}&order=updated_at.desc.nullslast&limit=1`
    );

    if (Array.isArray(byUser) && byUser.length > 0) {
      return byUser[0];
    }
  }

  return null;
}

async function upsertSubscriptionRecord(env, record) {
  const existing = await findExistingSubscription(env, record);

  if (existing?.id) {
    const updated = await supabaseRequest(env, `/rest/v1/subscriptions?id=eq.${existing.id}`, {
      method: "PATCH",
      headers: {
        prefer: "return=representation"
      },
      body: JSON.stringify(record)
    });

    return {
      action: "updated",
      row: Array.isArray(updated) ? updated[0] || null : updated
    };
  }

  const inserted = await supabaseRequest(env, "/rest/v1/subscriptions", {
    method: "POST",
    headers: {
      prefer: "return=representation"
    },
    body: JSON.stringify([record])
  });

  return {
    action: "inserted",
    row: Array.isArray(inserted) ? inserted[0] || null : inserted
  };
}

async function handleStripeWebhookEvent(event, env) {
  if (event.type === "checkout.session.completed") {
    const record = buildSubscriptionRecordFromCheckoutSession(event.data?.object || {});
    if (!record.user_id) {
      throw new Error("Webhook session is missing user_id metadata.");
    }

    return upsertSubscriptionRecord(env, record);
  }

  if (event.type === "customer.subscription.created") {
    const record = buildSubscriptionRecordFromSubscription(event.data?.object || {});
    if (!record.user_id) {
      throw new Error("Webhook subscription is missing user_id metadata.");
    }

    return upsertSubscriptionRecord(env, record);
  }

  return {
    action: "ignored",
    row: null
  };
}

function buildCheckoutUrl(baseUrl, status) {
  const url = new URL(baseUrl);
  url.searchParams.set("checkout", status);
  return url.toString();
}

function resolveCheckoutReturnUrl(request, explicitUrl, fallbackStatus) {
  if (explicitUrl) {
    return explicitUrl;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    return buildCheckoutUrl(origin, fallbackStatus);
  }

  return buildCheckoutUrl(request.url, fallbackStatus);
}

function getStripePriceForTier(env, tier) {
  if (tier === "pro") {
    return String(env.STRIPE_PRICE_PRO || "");
  }

  return "";
}

async function createStripeCheckoutSession(env, payload, request) {
  const stripeSecretKey = String(env.STRIPE_SECRET_KEY || "");
  const requestedTier = String(payload?.tier || "pro").toLowerCase();
  const stripePrice = getStripePriceForTier(env, requestedTier);
  const userContext = getAuthenticatedUserContext(request);

  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripePrice) {
    throw new Error(`No Stripe price is configured for tier "${requestedTier}".`);
  }

  if (!userContext.userId) {
    throw new Error("Unauthorized");
  }

  const successUrl = resolveCheckoutReturnUrl(request, payload?.successUrl, "success");
  const cancelUrl = resolveCheckoutReturnUrl(request, payload?.cancelUrl, "cancel");
  const form = new URLSearchParams();

  form.set("mode", "subscription");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("line_items[0][price]", stripePrice);
  form.set("line_items[0][quantity]", "1");
  form.set("allow_promotion_codes", "true");
  form.set("metadata[tier]", requestedTier);
  form.set("subscription_data[metadata][tier]", requestedTier);
  if (userContext.userId) {
    form.set("client_reference_id", userContext.userId);
    form.set("metadata[user_id]", userContext.userId);
    form.set("subscription_data[metadata][user_id]", userContext.userId);
  }
  if (userContext.email) {
    form.set("customer_email", userContext.email);
    form.set("metadata[user_email]", userContext.email);
    form.set("subscription_data[metadata][user_email]", userContext.email);
  }

  const response = await fetch(`${STRIPE_API_BASE_URL}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const stripeMessage = result?.error?.message || `stripe_http_${response.status}`;
    throw new Error(stripeMessage);
  }

  if (!result?.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return {
    ok: true,
    id: result.id,
    url: result.url,
    mode: result.mode,
    tier: requestedTier
  };
}

function buildJobDefinitions(env) {
  return [
    {
      key: "dashboard-signals",
      label: "refresh dashboard signals",
      path: env.DASHBOARD_SIGNALS_PATH || DEFAULT_DASHBOARD_SIGNALS_PATH
    },
    {
      key: "activity-feed",
      label: "update activity feed",
      path: env.ACTIVITY_FEED_PATH || DEFAULT_ACTIVITY_FEED_PATH
    },
    {
      key: "metrics-snapshots",
      label: "write metrics snapshots",
      path: env.METRICS_SNAPSHOTS_PATH || DEFAULT_METRICS_SNAPSHOTS_PATH
    }
  ];
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function verifyCronAuthorization(request, env) {
  const expected = String(env.CRON_AUTH_TOKEN || "");
  if (!expected) {
    return true;
  }

  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

function buildDashboardSignalsPayload(timestamp) {
  const signals = [
    {
      id: crypto.randomUUID(),
      title: "Macro pressure rising across AI infrastructure channels",
      severity: "high",
      score: 92
    },
    {
      id: crypto.randomUUID(),
      title: "Subscriber conversion momentum stable in premium cohorts",
      severity: "medium",
      score: 74
    },
    {
      id: crypto.randomUUID(),
      title: "Narrative volatility detected in geopolitical feed clustering",
      severity: "medium",
      score: 68
    }
  ];

  return {
    generatedAt: timestamp,
    signalCount: signals.length,
    topSeverity: signals[0]?.severity || "normal",
    signals
  };
}

function buildActivityFeedPayload(timestamp) {
  const items = [
    {
      id: crypto.randomUUID(),
      type: "system",
      title: "Daily signal refresh completed",
      detail: "ARCHAIOS refreshed premium signal groupings for the next operator cycle.",
      createdAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      type: "traffic",
      title: "Activity surge detected",
      detail: "Traffic routing shifted toward conversion-heavy entry points.",
      createdAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      type: "analytics",
      title: "Revenue posture snapshot generated",
      detail: "Mock revenue and engagement posture has been recomputed for dashboard display.",
      createdAt: timestamp
    }
  ];

  return {
    generatedAt: timestamp,
    itemCount: items.length,
    items
  };
}

function buildMetricsSnapshotPayload(timestamp) {
  return {
    generatedAt: timestamp,
    metrics: {
      leadSubmissions: 37,
      ctaClicks: 112,
      activeSubscribers: 18,
      monthlyRecurringRevenue: 1470,
      conversionRate: 4.8
    }
  };
}

async function insertSupabaseRows(env, tableName, rows) {
  const supabaseUrl = normalizeBaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!supabaseUrl || !serviceRoleKey || !tableName) {
    return {
      ok: false,
      skipped: true,
      inserted: 0,
      reason: "supabase_not_configured"
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(env.SUPABASE_REQUEST_TIMEOUT_MS || DEFAULT_SUPABASE_TIMEOUT_MS);
  const timeoutId = setTimeout(() => controller.abort("supabase_timeout"), timeoutMs);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        prefer: "return=representation"
      },
      body: JSON.stringify(rows)
    });

    const payload = await response.text();
    if (!response.ok) {
      throw new Error(`supabase_http_${response.status}:${payload.slice(0, 400)}`);
    }

    return {
      ok: true,
      skipped: false,
      inserted: Array.isArray(rows) ? rows.length : 1
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      inserted: 0,
      error: String(error?.message || error || "supabase_insert_failed")
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function logCronRun(env, payload) {
  return insertSupabaseRows(env, env.SUPABASE_CRON_RUNS_TABLE || "cron_job_runs", [payload]);
}

async function persistDashboardSignals(env, runId, payload, trigger) {
  const record = {
    run_id: runId,
    trigger,
    generated_at: payload.generatedAt,
    signal_count: payload.signalCount,
    top_severity: payload.topSeverity,
    signals: payload.signals
  };

  return insertSupabaseRows(env, env.SUPABASE_DASHBOARD_SIGNALS_TABLE || "dashboard_signal_runs", [record]);
}

async function persistActivityFeed(env, runId, payload, trigger) {
  const rows = payload.items.map((item) => ({
    run_id: runId,
    trigger,
    event_type: item.type,
    title: item.title,
    detail: item.detail,
    created_at: item.createdAt
  }));

  return insertSupabaseRows(env, env.SUPABASE_ACTIVITY_FEED_TABLE || "activity_feed_runs", rows);
}

async function persistMetricsSnapshot(env, runId, payload, trigger) {
  const record = {
    run_id: runId,
    trigger,
    generated_at: payload.generatedAt,
    metrics: payload.metrics
  };

  return insertSupabaseRows(env, env.SUPABASE_METRICS_SNAPSHOTS_TABLE || "metrics_snapshots", [record]);
}

async function handleCronEndpoint({ request, env, jobKey, generatePayload, persistPayload }) {
  if (!verifyCronAuthorization(request, env)) {
    return createJsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = await readJsonBody(request);
  const timestamp = new Date().toISOString();
  const runId = body.runId || crypto.randomUUID();
  const trigger = body.trigger || "manual";

  logEvent("info", "cron.endpoint.start", { job: jobKey, runId, trigger });

  const payload = generatePayload(timestamp);
  const supabaseResult = await persistPayload(env, runId, payload, trigger);
  const runLogResult = await logCronRun(env, {
    run_id: runId,
    job: jobKey,
    trigger,
    status: supabaseResult.ok || supabaseResult.skipped ? "ok" : "warning",
    request_payload: body,
    response_payload: payload,
    created_at: timestamp
  });

  if (!supabaseResult.ok && !supabaseResult.skipped) {
    logEvent("error", "cron.endpoint.supabase_failure", { job: jobKey, runId, error: supabaseResult.error || "unknown_error" });
  } else {
    logEvent("info", "cron.endpoint.success", {
      job: jobKey,
      runId,
      inserted: supabaseResult.inserted,
      supabaseSkipped: supabaseResult.skipped
    });
  }

  return createJsonResponse({
    ok: true,
    job: jobKey,
    runId,
    trigger,
    generatedAt: timestamp,
    supabase: supabaseResult,
    runLog: runLogResult,
    payload
  });
}

async function handleStripeCheckoutRequest(request, env) {
  const payload = await readJsonBody(request);
  const checkout = await createStripeCheckoutSession(env, payload, request);
  return createJsonResponse(checkout, 200, createCorsHeaders());
}

async function handleStripeWebhookRequest(request, env) {
  const rawBody = await request.text();
  await verifyStripeSignature(request, rawBody, env);

  const event = JSON.parse(rawBody || "{}");
  const result = await handleStripeWebhookEvent(event, env);

  logEvent("info", "stripe.webhook.processed", {
    type: event.type || "unknown",
    action: result.action,
    userId: maskIdentifier(result.row?.user_id || event.data?.object?.metadata?.user_id),
    customerId: maskIdentifier(result.row?.stripe_customer_id || event.data?.object?.customer),
    subscriptionId: maskIdentifier(result.row?.stripe_subscription_id || event.data?.object?.id || event.data?.object?.subscription)
  });

  return createJsonResponse(
    {
      ok: true,
      received: true,
      type: event.type || "unknown",
      action: result.action
    },
    200,
    createCorsHeaders()
  );
}

async function runBackendJob(job, env, runId, baseUrlOverride = "") {
  const backendBaseUrl = normalizeBaseUrl(baseUrlOverride || env.BACKEND_BASE_URL);
  if (!backendBaseUrl) {
    throw new Error("BACKEND_BASE_URL is required.");
  }

  const timeoutMs = Number(env.CRON_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS);
  const url = new URL(job.path, `${backendBaseUrl}/`);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(`timeout:${job.key}`), timeoutMs);

  try {
    logEvent("info", "cron.job.start", { runId, job: job.key, url: url.toString() });

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(env.CRON_AUTH_TOKEN ? { authorization: `Bearer ${env.CRON_AUTH_TOKEN}` } : {}),
        "x-archaios-cron-job": job.key,
        "x-archaios-cron-run-id": runId
      },
      body: JSON.stringify({
        job: job.key,
        runId,
        trigger: "scheduled"
      })
    });

    const responseText = await response.text();
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      throw new Error(`http_${response.status}:${responseText.slice(0, 400)}`);
    }

    logEvent("info", "cron.job.success", {
      runId,
      job: job.key,
      status: response.status,
      durationMs
    });

    return {
      ok: true,
      job: job.key,
      status: response.status,
      durationMs,
      body: responseText.slice(0, 400)
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = String(error?.message || error || "cron_job_failed");

    logEvent("error", "cron.job.failure", {
      runId,
      job: job.key,
      durationMs,
      message
    });

    return {
      ok: false,
      job: job.key,
      durationMs,
      error: message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runDailyAutomation(env, trigger = "scheduled", selectedJobKey = "", baseUrlOverride = "") {
  const runId = crypto.randomUUID();
  const jobs = buildJobDefinitions(env).filter((job) => !selectedJobKey || job.key === selectedJobKey);

  if (!jobs.length) {
    throw new Error(`Unknown cron job: ${selectedJobKey}`);
  }

  logEvent("info", "cron.run.start", {
    runId,
    trigger,
    jobs: jobs.map((job) => job.key)
  });

  const results = [];
  for (const job of jobs) {
    results.push(await runBackendJob(job, env, runId, baseUrlOverride));
  }

  const failedJobs = results.filter((result) => !result.ok);
  const summary = {
    ok: failedJobs.length === 0,
    trigger,
    runId,
    startedAt: new Date().toISOString(),
    jobCount: jobs.length,
    failures: failedJobs.length,
    results
  };

  if (failedJobs.length > 0) {
    logEvent("error", "cron.run.failure", {
      runId,
      failures: failedJobs.map((job) => job.job)
    });
    throw new Error(JSON.stringify(summary));
  }

  logEvent("info", "cron.run.success", {
    runId,
    jobs: jobs.map((job) => job.key)
  });
  return summary;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = createCorsHeaders();

    if (request.method === "OPTIONS") {
      return createOptionsResponse();
    }

    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      return createJsonResponse(buildHealthPayload(env), 200, corsHeaders);
    }

    if (
      request.method === "POST" &&
      (url.pathname === "/api/stripe/create-checkout-session" || url.pathname === "/api/stripe/checkout")
    ) {
      try {
        return await handleStripeCheckoutRequest(request, env);
      } catch (error) {
        return createJsonResponse(
          {
            ok: false,
            error: String(error?.message || error || "stripe_checkout_failed")
          },
          500,
          corsHeaders
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/api/stripe/webhook") {
      try {
        return await handleStripeWebhookRequest(request, env);
      } catch (error) {
        logEvent("error", "stripe.webhook.failed", {
          message: String(error?.message || error || "stripe_webhook_failed")
        });

        return createJsonResponse(
          {
            ok: false,
            error: String(error?.message || error || "stripe_webhook_failed")
          },
          400,
          corsHeaders
        );
      }
    }

    if (request.method === "POST" && url.pathname === (env.DASHBOARD_SIGNALS_PATH || DEFAULT_DASHBOARD_SIGNALS_PATH)) {
      return handleCronEndpoint({
        request,
        env,
        jobKey: "dashboard-signals",
        generatePayload: buildDashboardSignalsPayload,
        persistPayload: persistDashboardSignals
      });
    }

    if (request.method === "POST" && url.pathname === (env.ACTIVITY_FEED_PATH || DEFAULT_ACTIVITY_FEED_PATH)) {
      return handleCronEndpoint({
        request,
        env,
        jobKey: "activity-feed",
        generatePayload: buildActivityFeedPayload,
        persistPayload: persistActivityFeed
      });
    }

    if (request.method === "POST" && url.pathname === (env.METRICS_SNAPSHOTS_PATH || DEFAULT_METRICS_SNAPSHOTS_PATH)) {
      return handleCronEndpoint({
        request,
        env,
        jobKey: "metrics-snapshots",
        generatePayload: buildMetricsSnapshotPayload,
        persistPayload: persistMetricsSnapshot
      });
    }

    if (request.method === "POST" && url.pathname === "/__scheduled") {
      try {
        const selectedJobKey = url.searchParams.get("job") || "";
        const summary = await runDailyAutomation(env, "manual", selectedJobKey, url.origin);
        return createJsonResponse(summary, 200, corsHeaders);
      } catch (error) {
        return createJsonResponse(
          {
            ok: false,
            trigger: "manual",
            error: String(error?.message || error || "manual_cron_failed")
          },
          500,
          corsHeaders
        );
      }
    }

    return createJsonResponse({ ok: false, error: "not_found" }, 404, corsHeaders);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runDailyAutomation(env, "scheduled", ""));
  }
};
