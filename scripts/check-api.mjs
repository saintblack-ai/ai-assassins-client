import { pathToFileURL } from 'node:url';
import { readApiJson } from '../src/lib/apiResponse.js';
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const date = x => text(x) && /(?:Z|[+-]\d\d:\d\d)$/.test(x) && Number.isFinite(Date.parse(x));
const number = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const tier = x => ['free', 'pro', 'elite'].includes(x);
const requireContract = condition => { if (!condition) throw Object.assign(new Error('Response contract mismatch'), { code: 'contract_mismatch' }); };
// Public core API contract, not worker/index.js's separate cron-worker contract.
export function validateHealth(p) {
  requireContract(object(p) && p.ok === true && p.service === 'archaios-core-api' && p.runtime === 'cloudflare-worker' && text(p.version) && p.release === p.version && date(p.timestamp) && object(p.dependencies) && ['configured', 'inactive'].includes(p.dependencies.supabase) && ['test_or_configured', 'test_or_inactive'].includes(p.dependencies.stripe));
  return { available: true, dependencies: { supabase: p.dependencies.supabase, stripe: p.dependencies.stripe }, paidReadiness: 'NOT_ESTABLISHED' };
}
export function validateDashboard(p, authenticated) {
  requireContract(object(p) && date(p.generatedAt) && tier(p.userTier) && object(p.user) && tier(p.user.tier) && p.userTier === p.user.tier && typeof p.user.paid === 'boolean' && typeof p.user.prioritySignals === 'boolean' && object(p.premium) && p.premium.currentTier === p.userTier &&
    ['limitedMode', 'delayedHighThreatAlerts', 'canRefreshRealtime', 'canGeneratePosts', 'canExtendCalendar', 'prioritySignals'].every(k => typeof p.premium[k] === 'boolean') &&
    Array.isArray(p.pricing) && ['free', 'pro', 'elite'].every(id => p.pricing.some(r => object(r) && r.id === id && text(r.name) && number(r.price) && text(r.displayPrice) && Array.isArray(r.features) && r.features.every(text))) &&
    Array.isArray(p.activityFeed) && p.activityFeed.every(r => object(r) && text(r.id) && text(r.actor) && text(r.action) && date(r.timestamp)) &&
    Array.isArray(p.agents) && p.agents.every(r => object(r) && text(r.id) && text(r.name) && typeof r.locked === 'boolean' && tier(r.minTier)) &&
    object(p.revenue) && ['monthlyRecurringRevenue', 'activeSubscribers', 'conversionRate', 'projectedRevenue'].every(k => number(p.revenue[k])) &&
    object(p.analytics) && number(p.analytics.leadSubmissions) && number(p.analytics.ctaClicks) && text(p.analytics.source) &&
    object(p.briefing) && text(p.briefing.title) && text(p.briefing.summary) && Array.isArray(p.briefing.actions) && p.briefing.actions.every(text));
  requireContract(authenticated ? text(p.user.id) : p.user.id === null && p.userTier === 'free');
  requireContract(p.user.paid === (p.userTier !== 'free') && p.user.prioritySignals === (p.userTier === 'elite'));
  return { contract: 'core-dashboard-v1', authenticatedIdentityPresent: authenticated };
}
export function validateBase(value) {
  const base = new URL(value);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Supply an HTTP(S) origin without credentials, path, query or fragment.');
  return base;
}
export async function checkApi({ base, mode = 'anonymous', anonymousDashboardStatus = 200, token, fetchImpl = fetch }) {
  base = validateBase(base);
  if (!['anonymous', 'authenticated', 'both'].includes(mode) || ![200, 401].includes(anonymousDashboardStatus)) throw new Error('Invalid check expectations.');
  const results = [];
  const get = async (path, authenticated, expectedStatus, validate) => {
    const result = { path, mode: authenticated ? 'authenticated' : 'anonymous', expectedStatus, checkedAt: new Date().toISOString() };
    try {
      const r = await fetchImpl(new URL(path, base), { method: 'GET', redirect: 'error', headers: { Accept: 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(20000) });
      result.status = r.status;
      result.contentType = r.headers.get('content-type');
      const p = await readApiJson(r);
      requireContract(r.status === expectedStatus && object(p));
      if (expectedStatus === 401) {
        requireContract(text(p.error));
        Object.assign(result, { passed: true, outcome: 'AUTH_REQUIRED', authenticatedFunctionality: 'UNVERIFIED' });
      } else Object.assign(result, validate(p), { passed: true, outcome: 'CONTRACT_PASS' });
    } catch (e) {
      result.passed = false;
      // Never reflect arbitrary server/network errors, payloads, URLs or tokens.
      result.error = ['invalid_api_response', 'contract_mismatch'].includes(e.code) ? e.code : 'request_failed';
    }
    results.push(result);
  };
  await get('/api/health', false, 200, validateHealth);
  if (mode !== 'authenticated') await get('/api/platform/dashboard', false, anonymousDashboardStatus, p => validateDashboard(p, false));
  if (mode !== 'anonymous') {
    if (!text(token) || /[\r\n]/.test(token)) results.push({ path: '/api/platform/dashboard', mode: 'authenticated', passed: false, outcome: 'BLOCKED', error: 'configured_authentication_missing' });
    else await get('/api/platform/dashboard', true, 200, p => validateDashboard(p, true));
  }
  return { results, passed: results.every(r => r.passed), productionReady: false, limitation: 'Structure checks do not verify paid flows, source truth or production readiness.' };
}
export async function main(args = process.argv.slice(2), env = process.env) {
  const [base = 'https://ai-assassins-client.vercel.app', ...flags] = args;
  let mode = 'anonymous', anonymousDashboardStatus = 200;
  for (const flag of flags) {
    if (flag.startsWith('--mode=')) mode = flag.slice(7);
    else if (flag.startsWith('--anonymous-dashboard-status=')) anonymousDashboardStatus = Number(flag.split('=')[1]);
    else throw new Error('Unknown option. Authentication uses API_CHECK_BEARER_TOKEN environment only.');
  }
  const report = await checkApi({ base, mode, anonymousDashboardStatus, token: env.API_CHECK_BEARER_TOKEN });
  console.log(JSON.stringify(report, null, 2));
  return report.passed ? 0 : report.results.some(r => r.outcome === 'BLOCKED') ? 2 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await main(); }
  catch { console.error('Invalid invocation: origin, --mode=anonymous|authenticated|both, optional --anonymous-dashboard-status=200|401.'); process.exitCode = 1; }
}
