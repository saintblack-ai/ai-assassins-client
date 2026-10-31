import test from 'node:test';
import assert from 'node:assert/strict';
import { checkApi, main, validateBase, validateDashboard, validateHealth } from './check-api.mjs';

const health = () => ({ ok: true, service: 'archaios-core-api', runtime: 'cloudflare-worker',
  version: 'synthetic-release-v1', release: 'synthetic-release-v1', timestamp: '2026-10-31T12:00:00Z',
  dependencies: { supabase: 'inactive', stripe: 'test_or_inactive' } });
const dashboard = (authenticated = false) => ({
  generatedAt: '2026-10-31T12:00:00Z', userTier: 'free',
  user: { id: authenticated ? 'synthetic-user' : null, tier: 'free', paid: false, prioritySignals: false },
  premium: { currentTier: 'free', limitedMode: true, delayedHighThreatAlerts: true,
    canRefreshRealtime: false, canGeneratePosts: false, canExtendCalendar: false, prioritySignals: false },
  pricing: ['free', 'pro', 'elite'].map(id => ({ id, name: id, price: 0, displayPrice: '$0', features: ['Synthetic feature'] })),
  activityFeed: [{ id: 'fixture-1', actor: 'Fixture', action: 'Test only', timestamp: '2026-10-31T12:00:00Z' }],
  agents: [{ id: 'fixture-agent', name: 'Synthetic agent', locked: true, minTier: 'pro' }],
  revenue: { monthlyRecurringRevenue: 0, activeSubscribers: 0, conversionRate: 0, projectedRevenue: 0 },
  analytics: { leadSubmissions: 0, ctaClicks: 0, source: 'synthetic-fixture' },
  briefing: { title: 'Test', summary: 'Synthetic fixture only', actions: ['No action performed'] }
});
const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'content-type': 'application/json; charset=utf-8' }
});
const base = 'https://synthetic.invalid';
const fetchFor = dashboardResponse => async url => url.pathname === '/api/health' ? json(health()) : dashboardResponse();

test('health checks exact service/runtime and required release, zoned timestamp, dependency fields', () => {
  assert.equal(validateHealth(health()).available, true);
  assert.equal(validateHealth(health()).paidReadiness, 'NOT_ESTABLISHED');
  for (const change of [
    { ok: 'true' }, { service: 'archaios-daily-automation' }, { runtime: 'node' },
    { release: '' }, { version: null }, { timestamp: '2026-10-31T12:00:00' },
    { timestamp: 'invalid' }, { dependencies: null }, { dependencies: { supabase: 'inactive' } }
  ]) assert.throws(() => validateHealth({ ...health(), ...change }), { code: 'contract_mismatch' });
});

test('dashboard checker accepts actual object structure and rejects incomplete or invalid field shapes', () => {
  assert.equal(validateDashboard(dashboard(), false).authenticatedIdentityPresent, false);
  assert.equal(validateDashboard(dashboard(true), true).authenticatedIdentityPresent, true);
  for (const change of [
    { generatedAt: 'yesterday' }, { userTier: 'root' }, { user: null }, { premium: {} },
    { pricing: [] }, { activityFeed: [{ id: 'bad' }] }, { agents: [{ id: 'bad' }] },
    { revenue: { ...dashboard().revenue, activeSubscribers: '0' } },
    { analytics: { ...dashboard().analytics, ctaClicks: -1 } }, { briefing: {} }
  ]) assert.throws(() => validateDashboard({ ...dashboard(), ...change }, false), { code: 'contract_mismatch' });
  for (const payload of [null, [], 'OK', true, { ok: true }]) {
    assert.throws(() => validateDashboard(payload, false), { code: 'contract_mismatch' });
  }
});

test('anonymous expected JSON 401 only establishes auth-required, never authenticated functionality', async () => {
  const report = await checkApi({ base, anonymousDashboardStatus: 401,
    fetchImpl: fetchFor(() => json({ error: 'Unauthorized' }, 401)) });
  assert.equal(report.passed, true);
  assert.equal(report.productionReady, false);
  assert.equal(report.results[1].outcome, 'AUTH_REQUIRED');
  assert.equal(report.results[1].authenticatedFunctionality, 'UNVERIFIED');
  assert.equal(report.results[1].mode, 'anonymous');
});

test('unexpected anonymous 401 fails the configured success expectation', async () => {
  const report = await checkApi({ base, fetchImpl: fetchFor(() => json({ error: 'Unauthorized' }, 401)) });
  assert.equal(report.passed, false);
  assert.equal(report.results[1].error, 'contract_mismatch');
});

test('HTTP 200 HTML, malformed and null JSON fail instead of passing SPA fallback', async () => {
  for (const response of [
    () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    () => json(null)
  ]) {
    const report = await checkApi({ base, fetchImpl: fetchFor(response) });
    assert.equal(report.passed, false);
    assert.equal(report.results[1].error, 'invalid_api_response');
  }
});

test('even expected 401 rejects HTML, malformed/null JSON and missing error envelope', async () => {
  for (const response of [
    () => new Response('Unauthorized', { status: 401, headers: { 'content-type': 'text/html' } }),
    () => new Response('{broken', { status: 401, headers: { 'content-type': 'application/json' } }),
    () => json(null, 401), () => json({}, 401), () => json({ error: '' }, 401)
  ]) {
    const report = await checkApi({ base, anonymousDashboardStatus: 401, fetchImpl: fetchFor(response) });
    assert.equal(report.passed, false);
    assert.equal(report.results[1].error, 'contract_mismatch');
  }
});

test('authenticated dashboard 200 with a guest identity fails', async () => {
  const report = await checkApi({ base, mode: 'authenticated', token: 'synthetic-credential',
    fetchImpl: fetchFor(() => json(dashboard(false))) });
  assert.equal(report.passed, false);
  assert.equal(report.results[1].mode, 'authenticated');
  assert.equal(report.results[1].error, 'contract_mismatch');
});

test('missing configured auth blocks authenticated part while completing anonymous reads', async () => {
  const calls = [];
  const report = await checkApi({ base, mode: 'both', fetchImpl: async (url, options) => {
    calls.push([url.pathname, options]);
    return url.pathname === '/api/health' ? json(health()) : json(dashboard());
  } });
  assert.equal(calls.length, 2);
  assert.equal(report.results[0].passed, true);
  assert.equal(report.results[1].passed, true);
  assert.equal(report.results[2].outcome, 'BLOCKED');
  assert.equal(report.results[2].error, 'configured_authentication_missing');
  assert.equal(report.passed, false);
});

test('main reads authentication only from environment, forwards GET header only, and never logs credential', async t => {
  const token = 'synthetic-env-only-credential';
  const calls = [], logs = [];
  t.mock.method(console, 'log', line => logs.push(line));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return url.pathname === '/api/health' ? json(health()) : json(dashboard(Boolean(options.headers.Authorization)));
  });
  assert.equal(await main([base, '--mode=both'], { API_CHECK_BEARER_TOKEN: token }), 0);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(({ url, options }) => url.origin === base && !url.search && options.method === 'GET' && options.redirect === 'error' && !options.body));
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[2].options.headers.Authorization, `Bearer ${token}`);
  assert.ok(logs.length === 1 && !logs.join('').includes(token));
  assert.equal(JSON.parse(logs[0]).productionReady, false);
  await assert.rejects(main([base, '--token=synthetic-command-argument'], {}), /Unknown option/);
});

test('network error details are redacted and newline-bearing auth is blocked before request', async () => {
  const token = 'synthetic-do-not-log';
  const report = await checkApi({ base, mode: 'authenticated', token,
    fetchImpl: async () => { throw new Error(token); } });
  assert.ok(!JSON.stringify(report).includes(token));
  assert.ok(report.results.every(row => row.error === 'request_failed'));
  let calls = 0;
  const invalidAuth = await checkApi({ base, mode: 'authenticated', token: 'synthetic\r\ninvalid',
    fetchImpl: async () => { calls++; return json(health()); } });
  assert.equal(calls, 1);
  assert.equal(invalidAuth.results[1].outcome, 'BLOCKED');
});

test('origin validation rejects credentials, query, paths and fragments', async () => {
  for (const url of ['https://user:synthetic@example.invalid', 'https://example.invalid/?key=synthetic',
    'https://example.invalid/#fragment', 'https://example.invalid/path', 'file:///tmp/test']) {
    assert.throws(() => validateBase(url));
  }
  assert.equal(validateBase(base).origin, base);
  await assert.rejects(checkApi({ base, mode: 'unknown' }));
  await assert.rejects(checkApi({ base, anonymousDashboardStatus: 403 }));
});
