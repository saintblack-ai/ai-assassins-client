var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
var DEFAULT_DASHBOARD_SIGNALS_PATH = "/api/internal/cron/dashboard-signals";
var DEFAULT_ACTIVITY_FEED_PATH = "/api/internal/cron/activity-feed";
var DEFAULT_METRICS_SNAPSHOTS_PATH = "/api/internal/cron/metrics-snapshots";
var DEFAULT_REQUEST_TIMEOUT_MS = 3e4;
var DEFAULT_SUPABASE_TIMEOUT_MS = 15e3;
function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}
__name(normalizeBaseUrl, "normalizeBaseUrl");
function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(createJsonResponse, "createJsonResponse");
function logEvent(level, event, context = {}) {
  const logger = level === "error" ? console.error : console.log;
  logger(JSON.stringify({ level, event, ...context }));
}
__name(logEvent, "logEvent");
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
__name(buildJobDefinitions, "buildJobDefinitions");
async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
__name(readJsonBody, "readJsonBody");
function verifyCronAuthorization(request, env) {
  const expected = String(env.CRON_AUTH_TOKEN || "");
  if (!expected) {
    return true;
  }
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}
__name(verifyCronAuthorization, "verifyCronAuthorization");
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
__name(buildDashboardSignalsPayload, "buildDashboardSignalsPayload");
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
__name(buildActivityFeedPayload, "buildActivityFeedPayload");
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
__name(buildMetricsSnapshotPayload, "buildMetricsSnapshotPayload");
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
__name(insertSupabaseRows, "insertSupabaseRows");
async function logCronRun(env, payload) {
  return insertSupabaseRows(env, env.SUPABASE_CRON_RUNS_TABLE || "cron_job_runs", [payload]);
}
__name(logCronRun, "logCronRun");
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
__name(persistDashboardSignals, "persistDashboardSignals");
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
__name(persistActivityFeed, "persistActivityFeed");
async function persistMetricsSnapshot(env, runId, payload, trigger) {
  const record = {
    run_id: runId,
    trigger,
    generated_at: payload.generatedAt,
    metrics: payload.metrics
  };
  return insertSupabaseRows(env, env.SUPABASE_METRICS_SNAPSHOTS_TABLE || "metrics_snapshots", [record]);
}
__name(persistMetricsSnapshot, "persistMetricsSnapshot");
async function handleCronEndpoint({ request, env, jobKey, generatePayload, persistPayload }) {
  if (!verifyCronAuthorization(request, env)) {
    return createJsonResponse({ ok: false, error: "unauthorized" }, 401);
  }
  const body = await readJsonBody(request);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
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
__name(handleCronEndpoint, "handleCronEndpoint");
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
        ...env.CRON_AUTH_TOKEN ? { authorization: `Bearer ${env.CRON_AUTH_TOKEN}` } : {},
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
__name(runBackendJob, "runBackendJob");
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
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
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
__name(runDailyAutomation, "runDailyAutomation");
var worker_default = {
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

// ../../../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-scheduled.ts
var scheduled = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  const url = new URL(request.url);
  if (url.pathname === "/__scheduled") {
    const cron = url.searchParams.get("cron") ?? "";
    await middlewareCtx.dispatch("scheduled", { cron });
    return new Response("Ran scheduled event");
  }
  const resp = await middlewareCtx.next(request, env);
  if (request.headers.get("referer")?.endsWith("/__scheduled") && url.pathname === "/favicon.ico" && resp.status === 500) {
    return new Response(null, { status: 404 });
  }
  return resp;
}, "scheduled");
var middleware_scheduled_default = scheduled;

// ../../../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-iqnVgf/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_scheduled_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-iqnVgf/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
