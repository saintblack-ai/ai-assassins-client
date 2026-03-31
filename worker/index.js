const DEFAULT_DASHBOARD_SIGNALS_PATH = "/api/internal/cron/dashboard-signals";
const DEFAULT_ACTIVITY_FEED_PATH = "/api/internal/cron/activity-feed";
const DEFAULT_METRICS_SNAPSHOTS_PATH = "/api/internal/cron/metrics-snapshots";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_SUPABASE_TIMEOUT_MS = 15000;

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function logEvent(level, event, context = {}) {
  const logger = level === "error" ? console.error : console.log;
  logger(JSON.stringify({ level, event, ...context }));
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

    if (request.method === "GET" && url.pathname === "/health") {
      return createJsonResponse({
        ok: true,
        service: "archaios-daily-automation",
        backendBaseUrlConfigured: Boolean(normalizeBaseUrl(env.BACKEND_BASE_URL)),
        cron: env.CRON_SCHEDULE || "17 13 * * *",
        jobs: buildJobDefinitions(env).map((job) => ({ key: job.key, path: job.path }))
      });
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
        return createJsonResponse(summary, 200);
      } catch (error) {
        return createJsonResponse(
          {
            ok: false,
            trigger: "manual",
            error: String(error?.message || error || "manual_cron_failed")
          },
          500
        );
      }
    }

    return createJsonResponse({ ok: false, error: "not_found" }, 404);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runDailyAutomation(env, "scheduled", ""));
  }
};
