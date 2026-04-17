import { useEffect, useMemo, useState } from "react";
import CommandNav from "../components/CommandNav";
import ProtectedContent from "../components/ProtectedContent";
import { startStripeCheckout } from "../agents/stripeAgent";
import { PRICING_TIERS } from "../lib/pricing";
import {
  createBillingPortalSession,
  fetchPlatformDashboard,
  fetchSubscription,
  getBackendHealthcheckUrl,
  getCurrentSession,
  subscribeToAuthChanges
} from "../lib/platform";
import {
  getContentAccessState,
  hasPlanAccess,
  normalizePlan,
  normalizeSubscriptionRecord
} from "../lib/subscription";
import { MOCK_PLATFORM_DASHBOARD, setMockMode, shouldUseMockData } from "../lib/mockPlatform";

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
const DASHBOARD_PATH = `${import.meta.env.BASE_URL || "/"}dashboard`.replace(/\/{2,}/g, "/");

function getCheckoutReturnState() {
  if (typeof window === "undefined") {
    return "";
  }

  const value = new URLSearchParams(window.location.search).get("checkout");
  return value === "success" || value === "cancel" ? value : "";
}

function clearCheckoutReturnState() {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("checkout");
  window.history.replaceState({}, "", nextUrl.toString());
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function DashboardMetric({ label, value, detail }) {
  return (
    <article className="saint-dashboard-card saint-dashboard-metric">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function resolveAudienceLabel(access) {
  if (access.active) {
    return access.plan === "elite" ? "Paid Elite" : "Paid Pro";
  }

  return "Free Preview";
}

function PricingCard({ plan, currentPlan, active, checkoutBusy, session, onCheckout }) {
  const isCurrent = currentPlan === plan.id;
  const isPaidPlan = plan.id === "pro" || plan.id === "elite";
  const isDisabled = !isPaidPlan || checkoutBusy || !session || (isCurrent && active);

  return (
    <article
      className={[
        "saint-dashboard-card",
        "saint-pricing-card",
        isCurrent ? "saint-pricing-card-current" : "",
        plan.id === "pro" ? "saint-pricing-card-featured" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="saint-card-head">
        <p className="eyebrow">{plan.name}</p>
        {plan.id === "pro" ? <span className="status-chip status-chip-live">Most Popular</span> : null}
      </div>
      <h3>{plan.displayPrice}</h3>
      <p>{plan.id === "free" ? "Preview access to the command dashboard." : "Uses the live Stripe checkout flow already connected to the worker."}</p>
      <ul className="saint-dashboard-list">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <button
        className={plan.id === "free" ? "ghost-button" : "primary-button"}
        type="button"
        onClick={() => {
          if (isPaidPlan) {
            onCheckout(plan.id);
          }
        }}
        disabled={isDisabled}
      >
        {plan.id === "free"
          ? "Current preview plan"
          : isCurrent && active
            ? "Current plan"
            : checkoutBusy
              ? "Starting..."
              : `Upgrade to ${plan.name}`}
      </button>
    </article>
  );
}

function LockedCard({ title, description, requiredPlan }) {
  return (
    <article className="saint-dashboard-card saint-dashboard-card-locked">
      <div className="saint-card-head">
        <p className="eyebrow">Locked</p>
        <span className="status-chip">Requires {normalizePlan(requiredPlan).toUpperCase()}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

function DashboardLayout({
  session,
  subscription,
  dashboard,
  health,
  loading,
  error,
  checkoutBusy,
  billingBusy,
  checkoutMessage,
  onCheckout,
  onManageBilling,
  onRefresh,
  mockEnabled,
  onToggleMock
}) {
  const access = getContentAccessState(subscription);
  const userEmail = session?.user?.email || "Guest";
  const activityFeed = Array.isArray(dashboard?.activityFeed) ? dashboard.activityFeed.slice(0, 4) : [];
  const briefingActions = Array.isArray(dashboard?.briefing?.actions) ? dashboard.briefing.actions.slice(0, 3) : [];
  const pricing = Array.isArray(dashboard?.pricing) && dashboard.pricing.length ? dashboard.pricing : PRICING_TIERS;
  const healthUrl = getBackendHealthcheckUrl();
  const paidState = resolveAudienceLabel(access);

  return (
    <main className="saint-dashboard-shell">
      <CommandNav current="dashboard" />
      <section className="saint-dashboard-hero">
        <div className="saint-dashboard-copy">
          <p className="eyebrow">Saint Black Command Dashboard</p>
          <h1>Monetization, access control, and AI features in one command surface.</h1>
          <p>
            The dashboard syncs your Supabase session, subscription state, and Stripe billing access while keeping locked
            content visible to free or inactive users.
          </p>
          <div className="saint-dashboard-actions">
            <button className="primary-button" type="button" onClick={() => onCheckout("pro")} disabled={checkoutBusy || !session}>
              {checkoutBusy ? "Starting..." : "Upgrade to Pro"}
            </button>
            <button className="ghost-button" type="button" onClick={() => onCheckout("elite")} disabled={checkoutBusy || !session}>
              Upgrade to Elite
            </button>
            <a className="ghost-button saint-link-button" href={`${import.meta.env.BASE_URL || "/"}pricing`}>
              Pricing Page
            </a>
            <a className="ghost-button saint-link-button" href={`${import.meta.env.BASE_URL || "/"}landing`}>
              Public Landing
            </a>
            <button className="ghost-button" type="button" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh dashboard"}
            </button>
            <button className="ghost-button" type="button" onClick={onToggleMock}>
              {mockEnabled ? "Disable mock mode" : "Enable mock mode"}
            </button>
            <a className="ghost-button saint-link-button" href={`${import.meta.env.BASE_URL || "/"}book-growth`}>
              Book Growth Command
            </a>
            <a className="ghost-button saint-link-button" href={`${import.meta.env.BASE_URL || "/"}operator`}>
              Operator Mode
            </a>
            <a className="ghost-button saint-link-button" href={`${import.meta.env.BASE_URL || "/"}#auth`}>
              {session ? "Back to home" : "Sign in from home"}
            </a>
          </div>
          {!session ? <p className="saint-dashboard-note">Signed-out users can view the dashboard shell, but checkout stays blocked until sign-in.</p> : null}
          {checkoutMessage ? <p className="saint-dashboard-note">{checkoutMessage}</p> : null}
          {error ? <p className="panel-note panel-note-error">{error}</p> : null}
        </div>

        <div className="saint-dashboard-hero-panel">
          <div className="status-row">
            <div className="status-chip">Account: {userEmail}</div>
            <div className="status-chip">Tier: {access.plan.toUpperCase()}</div>
            <div className="status-chip">Status: {access.status}</div>
            <div className="status-chip">Audience: {paidState}</div>
            <div className="status-chip">Experience: {access.experience.name}</div>
            <div className="status-chip">Health: {health.ok ? "online" : "check backend"}</div>
            {mockEnabled ? <div className="status-chip status-chip-live">Mock mode active</div> : null}
          </div>
          <div className="saint-dashboard-grid">
            <DashboardMetric
              label="Subscription"
              value={access.active ? "Active" : "Inactive"}
              detail={access.active ? "Premium access is currently unlocked." : "Locked content remains visible but unavailable."}
            />
            <DashboardMetric
              label="AI Features"
              value={access.canUseAiTools ? "Enabled" : "Locked"}
              detail={access.canUseAiTools ? "Pro and Elite tools are available." : "Upgrade to unlock AI tools."}
            />
            <DashboardMetric
              label="Period End"
              value={formatDate(access.currentPeriodEnd)}
              detail="Latest period end returned by the backend subscription record."
            />
            <DashboardMetric
              label="Signals"
              value={access.canAccessEliteSignals ? "Elite" : access.active ? "Standard" : "Preview"}
              detail="Feature availability follows the active subscription record."
            />
          </div>
        </div>
      </section>

      <section className="saint-dashboard-section-grid">
        <article className="saint-dashboard-card">
          <div className="saint-card-head">
            <p className="eyebrow">Account Overview</p>
            <span className="status-chip">{session ? "Authenticated" : "Guest"}</span>
          </div>
          <h2>Operator identity</h2>
          <p>Supabase browser auth is the source of truth for the active session.</p>
          <ul className="saint-dashboard-list">
            <li>Email: {userEmail}</li>
            <li>User ID: {session?.user?.id || "No active session"}</li>
            <li>Paid or free: {paidState}</li>
            <li>Backend health URL: {healthUrl}</li>
          </ul>
        </article>

        <article className="saint-dashboard-card">
          <div className="saint-card-head">
            <p className="eyebrow">Subscription Status</p>
            <span className={`status-chip ${access.active ? "status-chip-live" : ""}`}>{access.status}</span>
          </div>
          <h2>Billing access</h2>
          <p>The worker-backed subscription endpoint controls content visibility and upgrade behavior.</p>
          <ul className="saint-dashboard-list">
            <li>Current plan: {access.plan}</li>
            <li>Experience layer: {access.experience.name}</li>
            <li>Briefing access: {access.experience.briefing}</li>
            <li>Current status: {access.status}</li>
            <li>Stripe customer: {access.stripeCustomerId || "Not linked yet"}</li>
            <li>Stripe subscription: {access.stripeSubscriptionId || "Not linked yet"}</li>
          </ul>
          <div className="saint-dashboard-inline-actions">
            <button className="primary-button" type="button" onClick={() => onCheckout("pro")} disabled={checkoutBusy || !session || hasPlanAccess(access.plan, "pro")}>
              Upgrade to Pro
            </button>
            <button className="ghost-button" type="button" onClick={() => onCheckout("elite")} disabled={checkoutBusy || !session || access.plan === "elite"}>
              Upgrade to Elite
            </button>
            <button className="ghost-button" type="button" onClick={onManageBilling} disabled={billingBusy || !session || !access.canManageBilling}>
              {billingBusy ? "Opening..." : "Manage billing"}
            </button>
          </div>
        </article>

        <article className="saint-dashboard-card">
          <div className="saint-card-head">
            <p className="eyebrow">Content Access</p>
            <span className="status-chip">{access.unlocked ? "Unlocked" : "Locked"}</span>
          </div>
          <h2>Access control state</h2>
          <p>{access.experience.headline}</p>
          <div className="saint-access-grid">
            <div className={`saint-access-pill ${access.canViewPreview ? "is-open" : ""}`}>Preview shell</div>
            <div className={`saint-access-pill ${access.canViewFullBriefing ? "is-open" : ""}`}>Full briefing</div>
            <div className={`saint-access-pill ${access.canUseAiTools ? "is-open" : ""}`}>AI tools</div>
            <div className={`saint-access-pill ${access.canAccessEliteSignals ? "is-open" : ""}`}>Elite signals</div>
          </div>
        </article>

        <article className="saint-dashboard-card">
          <div className="saint-card-head">
            <p className="eyebrow">Live Worker Data</p>
            <span className="status-chip">{loading ? "Refreshing" : "Loaded"}</span>
          </div>
          <h2>API status</h2>
          <p>This page reads from the already-live worker and renders the guest or signed-in view without changing backend logic.</p>
          <ul className="saint-dashboard-list">
            <li>`/api/health`: {health.ok ? "ok" : "not confirmed"}</li>
            <li>`/api/platform/dashboard`: {dashboard ? "loaded" : "waiting"}</li>
            <li>Returned user tier: {dashboard?.userTier || "free"}</li>
            <li>Pricing records received: {pricing.length}</li>
            <li>Mock mode: {mockEnabled ? "on" : "off"}</li>
          </ul>
        </article>
      </section>

      <section className="saint-dashboard-pricing-section">
        <div className="saint-dashboard-section-heading">
          <p className="eyebrow">Pricing</p>
          <h2>Free, Pro, and Elite</h2>
          <p>Use the existing Stripe checkout flow to move from preview mode into the paid dashboard experience.</p>
        </div>
        <div className="saint-pricing-grid">
          {pricing.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              currentPlan={access.plan}
              active={access.active}
              checkoutBusy={checkoutBusy}
              session={session}
              onCheckout={onCheckout}
            />
          ))}
        </div>
      </section>

      <section className="saint-dashboard-section-grid">
        <article className="saint-dashboard-card saint-dashboard-card-wide">
          <div className="saint-card-head">
            <p className="eyebrow">Mock Data Mode</p>
            <span className={`status-chip ${mockEnabled ? "status-chip-live" : ""}`}>{mockEnabled ? "Enabled" : "Disabled"}</span>
          </div>
          <h2>Pre-export dashboard testing</h2>
          <p>
            Use mock mode to test the dashboard, briefing, activity feed, and feature gates while live backend credentials
            or the ChatGPT export are unavailable.
          </p>
          <div className="saint-dashboard-inline-actions">
            <button className="primary-button" type="button" onClick={onToggleMock}>
              {mockEnabled ? "Turn mock mode off" : "Turn mock mode on"}
            </button>
            <a className="ghost-button saint-link-button" href={`${import.meta.env.BASE_URL || "/"}operator`}>
              Review operator shell
            </a>
          </div>
        </article>
      </section>

      <section className="saint-dashboard-section-grid">
        <ProtectedContent
          requiredPlan="pro"
          currentPlan={access.plan}
          status={access.status}
          title="AI Tools"
          description="Upgrade to Pro or Elite to unlock the AI tool suite."
        >
          <article className="saint-dashboard-card">
            <div className="saint-card-head">
              <p className="eyebrow">AI Tools</p>
              <span className="status-chip status-chip-live">Unlocked</span>
            </div>
            <h3>Paid AI workspace</h3>
            <p>{dashboard?.briefing?.summary || "AI features are live for your current plan."}</p>
            <ul className="saint-dashboard-list">
              {briefingActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </article>
        </ProtectedContent>

        <ProtectedContent
          requiredPlan="pro"
          currentPlan={access.plan}
          status={access.status}
          title="Music Library"
          description="Music content unlocks on an active paid plan."
        >
          <article className="saint-dashboard-card">
            <div className="saint-card-head">
              <p className="eyebrow">Music</p>
              <span className="status-chip status-chip-live">Unlocked</span>
            </div>
            <h3>Music content</h3>
            <p>Premium plan members can access curated music drops and release planning surfaces.</p>
          </article>
        </ProtectedContent>

        <ProtectedContent
          requiredPlan="pro"
          currentPlan={access.plan}
          status={access.status}
          title="Books Library"
          description="Book access opens with an active paid plan."
        >
          <article className="saint-dashboard-card">
            <div className="saint-card-head">
              <p className="eyebrow">Books</p>
              <span className="status-chip status-chip-live">Unlocked</span>
            </div>
            <h3>Books and long-form intelligence</h3>
            <p>Readers on paid plans get access to premium books and long-form command material.</p>
          </article>
        </ProtectedContent>
      </section>

      <section className="saint-dashboard-section-grid">
        <article className="saint-dashboard-card saint-dashboard-card-wide">
          <div className="saint-card-head">
            <p className="eyebrow">Platform Brief</p>
            <span className="status-chip">{dashboard?.userTier || access.plan}</span>
          </div>
          <h2>{dashboard?.briefing?.title || "Daily Platform Brief"}</h2>
          <p>{dashboard?.briefing?.summary || "Dashboard insights will appear here after the worker returns platform data."}</p>
        </article>

        <article className="saint-dashboard-card">
          <div className="saint-card-head">
            <p className="eyebrow">Recent Activity</p>
            <span className="status-chip">{activityFeed.length} items</span>
          </div>
          <h2>Command feed</h2>
          {activityFeed.length ? (
            <ul className="saint-dashboard-list">
              {activityFeed.map((item, index) => (
                <li key={`${item.title || item.label || "feed"}-${index}`}>{item.title || item.label || item.summary || "Activity recorded"}</li>
              ))}
            </ul>
          ) : (
            <p>Activity feed will populate when the backend dashboard endpoint responds with live data.</p>
          )}
        </article>
      </section>

      {!access.active ? (
        <section className="saint-dashboard-section-grid">
          <LockedCard
            title="Upgrade screen"
            description="Your subscription is inactive, so paid AI tools and premium media stay locked until checkout completes."
            requiredPlan="pro"
          />
        </section>
      ) : null}
    </main>
  );
}

function AdminLayout({ session, adminData, loading, error, adminConfigured, authorized, onRefresh }) {
  if (!session) {
    return (
      <main className="saint-dashboard-shell">
        <section className="saint-dashboard-hero">
          <div className="saint-dashboard-copy">
            <p className="eyebrow">Hidden Admin Route</p>
            <h1>Admin access requires a signed-in session.</h1>
            <p>Sign in with the configured admin account, then return to this route.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!adminConfigured) {
    return (
      <main className="saint-dashboard-shell">
        <section className="saint-dashboard-hero">
          <div className="saint-dashboard-copy">
            <p className="eyebrow">Hidden Admin Route</p>
            <h1>Admin email is not configured.</h1>
            <p>Set `VITE_ADMIN_EMAIL` in the frontend and `ADMIN_EMAIL` in the worker to activate the protected admin route.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="saint-dashboard-shell">
        <section className="saint-dashboard-hero">
          <div className="saint-dashboard-copy">
            <p className="eyebrow">Hidden Admin Route</p>
            <h1>Access denied.</h1>
            <p>This route only opens when the authenticated email matches the configured admin email.</p>
          </div>
        </section>
      </main>
    );
  }

  const logs = Array.isArray(adminData?.webhookLogs) ? adminData.webhookLogs : [];

  return (
    <main className="saint-dashboard-shell">
      <section className="saint-dashboard-hero">
        <div className="saint-dashboard-copy">
          <p className="eyebrow">Admin Command Surface</p>
          <h1>Subscription and webhook oversight.</h1>
          <p>This hidden route surfaces subscription counts and recent Stripe webhook activity without touching the existing webhook logic.</p>
          <div className="saint-dashboard-actions">
            <button className="primary-button" type="button" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh admin metrics"}
            </button>
            <a className="ghost-button saint-link-button" href={DASHBOARD_PATH}>
              Open dashboard
            </a>
          </div>
          {error ? <p className="panel-note panel-note-error">{error}</p> : null}
        </div>
        <div className="saint-dashboard-grid">
          <DashboardMetric label="Total users" value={adminData?.totalUsers ?? 0} detail="Counted from Supabase profiles." />
          <DashboardMetric label="Active subscriptions" value={adminData?.activeSubscriptions ?? 0} detail="Active and trialing paid subscriptions." />
          <DashboardMetric label="Webhook logs" value={logs.length} detail="Recent Stripe webhook events returned by the worker." />
        </div>
      </section>

      <section className="saint-dashboard-section-grid">
        <article className="saint-dashboard-card saint-dashboard-card-wide">
          <div className="saint-card-head">
            <p className="eyebrow">Webhook Logs</p>
            <span className="status-chip">{logs.length ? "Live" : "Empty"}</span>
          </div>
          <h2>Recent Stripe webhook activity</h2>
          {logs.length ? (
            <div className="saint-admin-log-list">
              {logs.map((log) => (
                <div className="saint-admin-log-row" key={`${log.createdAt}-${log.eventType || log.status}`}>
                  <strong>{log.eventType || "stripe.event"}</strong>
                  <span>{log.status || "unknown"}</span>
                  <span>{log.tier || "n/a"}</span>
                  <span>{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No webhook logs were returned for this admin view.</p>
          )}
        </article>
      </section>
    </main>
  );
}

export default function DashboardPage({ adminMode = false }) {
  const [session, setSession] = useState(null);
  const [subscription, setSubscription] = useState(() => normalizeSubscriptionRecord(null));
  const [dashboard, setDashboard] = useState(null);
  const [health, setHealth] = useState({ ok: false });
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState(() => {
    const state = getCheckoutReturnState();
    if (state === "success") {
      return "Stripe returned successfully. Refreshing your subscription access.";
    }
    if (state === "cancel") {
      return "Checkout was canceled. Your access has not changed.";
    }
    return "";
  });
  const [mockEnabled, setMockEnabledState] = useState(() => shouldUseMockData());

  useEffect(() => {
    let mounted = true;

    getCurrentSession().then((nextSession) => {
      if (mounted) {
        setSession(nextSession);
      }
    });

    const listener = subscribeToAuthChanges((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
      }
    });

    return () => {
      mounted = false;
      listener.data.subscription.unsubscribe();
    };
  }, []);

  const authorizedAdmin = useMemo(() => {
    return Boolean(session?.user?.email && ADMIN_EMAIL && session.user.email.toLowerCase() === ADMIN_EMAIL);
  }, [session?.user?.email]);

  const refresh = async () => {
    setLoading(true);
    setError("");

    try {
      const healthResult = await fetch(getBackendHealthcheckUrl())
        .then((response) => response.json())
        .catch(() => ({ ok: false }));
      setHealth({ ok: Boolean(healthResult?.ok) });
      const dashboardPayload = await fetchPlatformDashboard(session?.access_token || null).catch(() => null);
      const resolvedDashboard = mockEnabled ? MOCK_PLATFORM_DASHBOARD : dashboardPayload;
      let normalizedSubscription = normalizeSubscriptionRecord(null);

      if (session?.access_token) {
        const subscriptionPayload = await fetchSubscription(session.access_token);
        normalizedSubscription = normalizeSubscriptionRecord({
          ...subscriptionPayload,
          plan: subscriptionPayload?.plan || subscriptionPayload?.tier
        });
      }

      setSubscription(normalizedSubscription);
      setDashboard(resolvedDashboard);

      if (!session?.access_token) {
        setAdminData(null);
        return;
      }

      if (adminMode && authorizedAdmin) {
        const adminPayload = await fetch(`${String(import.meta.env.VITE_BACKEND_URL || "https://archaios-saas-worker.quandrix357.workers.dev").replace(/\/+$/, "")}/api/admin/dashboard`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }).then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(payload?.error || `admin_request_failed_${response.status}`);
          }
          return payload;
        });
        setAdminData(adminPayload);
      } else {
        setAdminData(null);
      }

      if (getCheckoutReturnState()) {
        clearCheckoutReturnState();
        if (normalizedSubscription.active) {
          setCheckoutMessage("Premium access is now unlocked.");
        }
      }
    } catch (nextError) {
      if (mockEnabled) {
        setDashboard(MOCK_PLATFORM_DASHBOARD);
        setHealth({ ok: false });
      }
      setError(String(nextError?.message || nextError || "Dashboard request failed."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [session?.access_token, adminMode, authorizedAdmin, mockEnabled]);

  const handleToggleMock = () => {
    const nextMockState = !mockEnabled;
    setMockMode(nextMockState);
    setMockEnabledState(nextMockState);
    if (nextMockState) {
      setDashboard(MOCK_PLATFORM_DASHBOARD);
      setCheckoutMessage("Mock mode is active. Live billing is not simulated.");
    } else {
      setCheckoutMessage("Mock mode disabled. Refreshing live worker data.");
    }
  };

  const handleCheckout = async (requestedPlan) => {
    if (!session?.access_token) {
      setError("Sign in on the home page before starting checkout.");
      return;
    }

    setCheckoutBusy(true);
    setError("");

    try {
      const payload = await startStripeCheckout(session.access_token, requestedPlan);
      if (!payload?.url) {
        throw new Error("Stripe checkout URL missing.");
      }
      window.location.href = payload.url;
    } catch (nextError) {
      setError(String(nextError?.message || nextError || "Checkout failed."));
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleManageBilling = async () => {
    if (!session?.access_token) {
      setError("Sign in before opening billing.");
      return;
    }

    setBillingBusy(true);
    setError("");

    try {
      const payload = await createBillingPortalSession(session.access_token, typeof window !== "undefined" ? window.location.href : undefined);
      const url = payload?.url || payload?.portalUrl || payload?.billingPortalUrl;
      if (!url) {
        throw new Error("Billing portal URL missing.");
      }
      window.location.href = url;
    } catch (nextError) {
      setError(String(nextError?.message || nextError || "Billing portal is unavailable."));
    } finally {
      setBillingBusy(false);
    }
  };

  if (adminMode) {
    return (
      <AdminLayout
        session={session}
        adminData={adminData}
        loading={loading}
        error={error}
        adminConfigured={Boolean(ADMIN_EMAIL)}
        authorized={authorizedAdmin}
        onRefresh={refresh}
      />
    );
  }

  return (
    <DashboardLayout
      session={session}
      subscription={subscription}
      dashboard={dashboard}
      health={health}
      loading={loading}
      error={error}
      checkoutBusy={checkoutBusy}
      billingBusy={billingBusy}
      checkoutMessage={checkoutMessage}
      onCheckout={handleCheckout}
      onManageBilling={handleManageBilling}
      onRefresh={refresh}
      mockEnabled={mockEnabled}
      onToggleMock={handleToggleMock}
    />
  );
}
