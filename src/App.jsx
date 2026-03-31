import { useEffect, useMemo, useRef, useState } from "react";
import { runIntelligenceAgents } from "./agents/alertCenter";
import { startStripeCheckout } from "./agents/stripeAgent";
import { PRICING_TIERS } from "./lib/pricing";
import { isSupabaseEnabled } from "./lib/supabase";
import {
  classifyAuthError,
  captureLead,
  clearUserAlerts,
  createBillingPortalSession,
  fetchPlatformDashboard,
  fetchSubscription,
  fetchUserAlerts,
  getBackendHealthcheckUrl,
  getCurrentSession,
  getUserTier,
  hasPaidAccess,
  logCtaClick,
  requestPasswordReset,
  resendConfirmationEmail,
  signIn,
  signOut,
  signUp,
  shouldPreferSignInForSignup,
  subscribeToAuthChanges,
  trackRevenueEvent,
  updatePassword
} from "./lib/platform";
import "./app.css";

const BRAND = "Saint Black";
const THEME = "ARCHAIOS";
const CHANNELS = ["TikTok", "Instagram", "Facebook"];
const STORAGE_KEY = "saint-black-marketing-system-v5";
const PENDING_CHECKOUT_KEY = "saint-black-pending-checkout-tier";
const REFRESH_INTERVAL_MS = 60000;
const AUTH_STATES = {
  signedOut: "signed-out",
  signedIn: "signed-in",
  confirmationNeeded: "email-confirmation-needed",
  passwordRecovery: "password-recovery"
};
const AUTH_FEEDBACK_STATES = {
  idle: "idle",
  emailSent: "email-sent",
  waitingConfirmation: "waiting-confirmation",
  error: "error"
};
const SIGNUP_COOLDOWN_SECONDS = 15;
const RESEND_COOLDOWN_SECONDS = 60;
const BACKEND_HEALTHCHECK_URL = getBackendHealthcheckUrl();
const CHECKOUT_SYNC_DELAYS_MS = [0, 1500, 2500, 4000, 6000, 9000];

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function urlIncludesRecoveryToken() {
  if (typeof window === "undefined") {
    return false;
  }

  const combined = `${window.location.search}${window.location.hash}`.toLowerCase();
  return combined.includes("type=recovery");
}

const CONTENT_PILLARS = [
  {
    label: "Spiritual Warfare",
    hooks: [
      "The war you feel is not random. It is targeted.",
      "Most people call it stress when it is really spiritual resistance.",
      "If your peace is under attack, your purpose probably is too."
    ],
    angles: [
      "discernment for modern founders",
      "protection rituals for focused execution",
      "how to recognize hidden opposition before a breakthrough"
    ]
  },
  {
    label: "Ancient Civilizations",
    hooks: [
      "Ancient empires scaled power without modern technology.",
      "The old world hid growth systems in symbols, temples, and trade routes.",
      "Civilizations fall when they forget the code that built them."
    ],
    angles: [
      "lessons from forgotten kingdoms",
      "mythic architecture as a blueprint for brand authority",
      "how symbols created loyalty before social media existed"
    ]
  },
  {
    label: "Cosmic Knowledge",
    hooks: [
      "There is information in the sky most brands never learn to read.",
      "Cosmic knowledge is strategy when you know how to translate it.",
      "Your next move lands different when it aligns with a larger pattern."
    ],
    angles: [
      "mapping timing to momentum",
      "turning esoteric ideas into content magnets",
      "using mystery to increase retention and curiosity"
    ]
  }
];

const CAPTION_TEMPLATES = [
  "Saint Black decodes the unseen layer behind power, purpose, and profit. {cta}",
  "If this message found you at the right time, follow Saint Black for the deeper blueprint. {cta}",
  "ARCHAIOS frequency activated. Save this, send it, and move with intention. {cta}",
  "Some people scroll. Others recognize a signal. Saint Black speaks to the second group. {cta}"
];

const HASHTAG_SETS = [
  ["#SaintBlack", "#SpiritualWarfare", "#AncientSecrets", "#CosmicKnowledge", "#DarkLuxury"],
  ["#SaintBlack", "#EsotericBrand", "#MysticMarketing", "#HiddenTruth", "#Archaios"],
  ["#SaintBlack", "#ConsciousCreator", "#SacredStrategy", "#MythicWisdom", "#FutureTemple"],
  ["#SaintBlack", "#ShadowWork", "#DivineTiming", "#AncientCodes", "#SignalNotNoise"]
];

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function rotate(list, index) {
  return list[index % list.length];
}

function summarizePerformance(posts) {
  return posts.reduce(
    (totals, post) => {
      totals.engagement += post.metrics.engagement;
      totals.clicks += post.metrics.clicks;
      totals.estimatedRevenue += post.estimatedRevenue;
      return totals;
    },
    { engagement: 0, clicks: 0, estimatedRevenue: 0 }
  );
}

function withHealthcheckHint(message) {
  if (!BACKEND_HEALTHCHECK_URL) {
    return message;
  }

  return `${message} Health check: ${BACKEND_HEALTHCHECK_URL}`;
}

function buildPosts(dateKey, options = {}) {
  const posts = [];
  let counter = options.startId || 1;

  CHANNELS.forEach((channel, channelIndex) => {
    for (let slot = 0; slot < 3; slot += 1) {
      const pillar = rotate(CONTENT_PILLARS, channelIndex + slot);
      const hook = rotate(pillar.hooks, slot + channelIndex);
      const angle = rotate(pillar.angles, channelIndex + slot);
      const captionTemplate = rotate(CAPTION_TEMPLATES, channelIndex + slot);
      const hashtags = rotate(HASHTAG_SETS, channelIndex + slot).join(" ");
      const boosted = options.boostTopPosts && channelIndex === 0 && slot === 0;
      const viewsBase = 3200 + channelIndex * 1200 + slot * 800;
      const views = viewsBase + (boosted ? 6200 : 0);
      const clicks = Math.round(views * (boosted ? 0.082 : 0.041 + slot * 0.006));
      const conversions = Math.max(1, Math.round(clicks * (boosted ? 0.12 : 0.05)));
      const estimatedRevenue = conversions * 49;
      const engagement = Math.round(views * (0.16 + slot * 0.018 + (boosted ? 0.05 : 0)));

      posts.push({
        id: `post-${counter}`,
        shortId: `${channel.slice(0, 2).toUpperCase()}-${slot + 1}`,
        date: dateKey,
        channel,
        pillar: pillar.label,
        title: `${pillar.label} Signal ${slot + 1}`,
        hook,
        caption: captionTemplate.replace("{cta}", "Upgrade through the Saint Black intelligence platform."),
        hashtags,
        estimatedRevenue,
        metrics: {
          views,
          engagement,
          clicks,
          conversions
        },
        script: [
          `Open on a dark frame with the title card: "${hook}"`,
          `On-camera: explain ${angle} in one bold sentence tied to ${BRAND}.`,
          "Cut to three rapid visual beats showing symbols, celestial motion, or ancient textures.",
          `Close with: "Join ${BRAND} intelligence for deeper signals."`
        ],
        status: boosted ? "winner" : "ready"
      });

      counter += 1;
    }
  });

  return posts;
}

function createCalendar() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date: formatDateKey(date),
      label: date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      }),
      focus: CONTENT_PILLARS[index % CONTENT_PILLARS.length].label,
      goal: ["Traffic", "Engagement", "Revenue"][index % 3]
    };
  });
}

function createSeedState() {
  const calendar = createCalendar();
  const posts = buildPosts(calendar[0].date, { startId: 1, boostTopPosts: true });

  return {
    brand: BRAND,
    theme: THEME,
    generatedAt: new Date().toISOString(),
    calendar,
    posts,
    performance: summarizePerformance(posts)
  };
}

function loadSystemState() {
  if (typeof window === "undefined") {
    return createSeedState();
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return createSeedState();
  }

  try {
    return JSON.parse(saved);
  } catch {
    return createSeedState();
  }
}

function createIntelligenceSeed() {
  const emptyFeed = {
    data: { items: [], live: false, fetchedAt: null, source: "idle", error: null },
    trend: "loading",
    status: "loading",
    error: null
  };

  return {
    market: emptyFeed,
    sitrep: emptyFeed,
    news: emptyFeed,
    alerts: [],
    history: [],
    persistence: { enabled: false, saved: 0 },
    webhook: { enabled: false, sent: 0 },
    systemLevel: "normal",
    notificationPayload: null,
    generatedAt: null,
    isRefreshing: false
  };
}

function createPlatformSeed() {
  return {
    generatedAt: null,
    pricing: PRICING_TIERS,
    userTier: "free",
    user: {
      id: null,
      email: null,
      tier: "free",
      paid: false,
      prioritySignals: false
    },
    premium: {
      currentTier: "free",
      limitedMode: true,
      delayedHighThreatAlerts: true,
      canRefreshRealtime: false,
      canGeneratePosts: false,
      canExtendCalendar: false,
      prioritySignals: false
    },
    activityFeed: [],
    agents: [],
    revenue: null,
    analytics: {
      leadSubmissions: 0,
      ctaClicks: 0,
      source: "local"
    },
    briefing: null
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

function formatPercent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatTime(value) {
  if (!value) {
    return "Awaiting sync";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
}

function normalizeSubscriptionState(subscription, tier) {
  const normalizedTier = firstDefined(subscription?.tier, subscription?.planTier, subscription?.plan_tier, tier, "free");
  const normalizedStatus = firstDefined(
    subscription?.status,
    subscription?.subscriptionStatus,
    subscription?.subscription_status,
    hasPaidAccess(normalizedTier) ? "active" : "free"
  );
  const stripeCustomerId = firstDefined(subscription?.stripeCustomerId, subscription?.stripe_customer_id, null);
  const stripeSubscriptionId = firstDefined(subscription?.stripeSubscriptionId, subscription?.stripe_subscription_id, null);
  const portalUrl = firstDefined(subscription?.portalUrl, subscription?.billingPortalUrl, subscription?.billing_portal_url, null);
  const billingState = firstDefined(
    subscription?.billingState,
    subscription?.billing_state,
    stripeCustomerId || stripeSubscriptionId ? "configured" : "not-configured"
  );

  return {
    tier: normalizedTier,
    status: normalizedStatus,
    paid: Boolean(firstDefined(subscription?.paid, subscription?.isPaid, hasPaidAccess(normalizedTier))),
    currentPeriodEnd: firstDefined(subscription?.currentPeriodEnd, subscription?.current_period_end, null),
    cancelAtPeriodEnd: Boolean(firstDefined(subscription?.cancelAtPeriodEnd, subscription?.cancel_at_period_end, false)),
    stripeCustomerId,
    stripeSubscriptionId,
    portalUrl,
    billingState,
    billingPortalReady: Boolean(portalUrl || stripeCustomerId || stripeSubscriptionId),
    lastSyncedAt: firstDefined(subscription?.lastSyncedAt, subscription?.updatedAt, subscription?.updated_at, null)
  };
}

function getCheckoutStateFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const state = params.get("checkout");
  return state === "success" || state === "cancel" ? state : "";
}

function levelLabel(level) {
  if (level === "high") {
    return "High threat";
  }
  if (level === "medium") {
    return "Medium threat";
  }
  return "Normal";
}

function tierRank(tier) {
  if (tier === "elite") {
    return 3;
  }
  if (tier === "pro") {
    return 2;
  }
  return 1;
}

function hasTierAccess(currentTier, requiredTier) {
  return tierRank(currentTier) >= tierRank(requiredTier);
}

function liveStatus(intelligence) {
  return intelligence.market.data.live && intelligence.news.data.live && intelligence.sitrep.data.live
    ? "live"
    : "offline";
}

function filterVisibleAlerts(alerts, tier) {
  if (tier === "elite") {
    return alerts;
  }
  if (tier === "pro") {
    return alerts;
  }
  return alerts.filter((alert) => alert.level !== "high").slice(0, 10);
}

function getSubscriptionStatusLabel(status) {
  if (status === "active") {
    return "Active";
  }
  if (status === "trialing") {
    return "Trialing";
  }
  if (status === "past_due") {
    return "Past due";
  }
  if (status === "canceled") {
    return "Canceled";
  }
  return "Free";
}

function getAuthStateLabel(authState) {
  if (authState === AUTH_STATES.signedIn) {
    return "Signed in";
  }
  if (authState === AUTH_STATES.confirmationNeeded) {
    return "Confirmation needed";
  }
  if (authState === AUTH_STATES.passwordRecovery) {
    return "Password recovery";
  }
  return "Signed out";
}

function getBillingStateLabel(account) {
  if (account.portalUrl) {
    return "Portal ready";
  }
  if (account.cancelAtPeriodEnd) {
    return "Cancels at period end";
  }
  if (account.billingState === "configured") {
    return "Billing configured";
  }
  if (account.billingState === "past_due") {
    return "Billing action required";
  }
  if (account.billingState === "not-configured") {
    return "No billing profile";
  }
  return account.billingState || "Unknown";
}

function getPanelState({ loading, error, items, requiresAuth, session }) {
  if (loading) {
    return "loading";
  }

  if (requiresAuth && !session) {
    return "auth-required";
  }

  if (error) {
    return "error";
  }

  if (Array.isArray(items) && items.length === 0) {
    return "empty";
  }

  if (!items) {
    return "empty";
  }

  return "live";
}

function PanelStateNotice({ state, loadingLabel, error, emptyLabel, authLabel }) {
  if (state === "loading") {
    return <div className="panel-note">{loadingLabel}</div>;
  }

  if (state === "auth-required") {
    return <div className="panel-note">{authLabel}</div>;
  }

  if (state === "error") {
    return <div className="panel-note panel-note-error">{error}</div>;
  }

  if (state === "empty") {
    return <div className="panel-note">{emptyLabel}</div>;
  }

  return <div className="panel-note">Live data connected.</div>;
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function SectionHeader({ eyebrow, title, body, action, onAction }) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="section-copy">{body}</p>
      </div>
      {action ? (
        <button className="ghost-button" onClick={onAction} type="button">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function SectionCtaBar({ title = "Unlock full access", body = "Upgrade now", onUpgrade }) {
  return (
    <div className="section-cta-bar">
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <button className="primary-button" type="button" onClick={onUpgrade}>
        Upgrade now
      </button>
    </div>
  );
}

function StatusIndicator({ status, label }) {
  return (
    <div className={`status-indicator ${status === "live" ? "is-live" : "is-offline"}`}>
      <span className="status-dot" />
      <strong>{label}</strong>
    </div>
  );
}

function AlertBadge({ level }) {
  return <span className={`alert-badge alert-${level}`}>{levelLabel(level)}</span>;
}

function PanelStatus({ agent, emptyLabel }) {
  if (agent.status === "loading" && agent.data.items.length === 0) {
    return <div className="panel-note">Loading {emptyLabel}...</div>;
  }

  if (agent.error) {
    return <div className="panel-note panel-note-error">Live request failed: {agent.error}</div>;
  }

  if (agent.status === "fallback") {
    return <div className="panel-note">Showing fallback data while live data is unavailable.</div>;
  }

  if (agent.data.items.length === 0) {
    return <div className="panel-note">No data available yet.</div>;
  }

  return null;
}

function StockPanel({ agent }) {
  return (
    <div className="intel-panel">
      <SectionHeader
        eyebrow="Live Stock Panel"
        title="Market pulse"
        body={`Trend: ${agent.trend}. Source: ${agent.data.source}. Last sync ${formatTime(agent.data.fetchedAt)}.`}
      />
      <PanelStatus agent={agent} emptyLabel="market data" />
      <div className="stock-grid">
        {(agent.data.items.length ? agent.data.items : [{ id: "loading-1" }, { id: "loading-2" }, { id: "loading-3" }]).map((item) => (
          <article className="stock-card" key={item.id}>
            {item.symbol ? (
              <>
                <div className="stock-head">
                  <strong>{item.symbol}</strong>
                  <span>{item.label}</span>
                </div>
                <div className="stock-body">
                  <h3>{formatCurrency(item.price)}</h3>
                  <p className={item.changePercent >= 0 ? "trend-up" : "trend-down"}>
                    {formatPercent(item.changePercent)}
                  </p>
                </div>
              </>
            ) : (
              <div className="skeleton-card">
                <div className="skeleton-line skeleton-short" />
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-medium" />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function SitrepPanel({ agent }) {
  return (
    <div className="intel-panel">
      <SectionHeader
        eyebrow="SITREP Map Panel"
        title="Conflict monitoring"
        body={`Trend: ${agent.trend}. Source: ${agent.data.source}. High-severity activity is surfaced first.`}
      />
      <div className="sitrep-map">
        {agent.data.items.map((item) => (
          <article className="sitrep-card" key={item.id}>
            <div className="sitrep-header">
              <strong>{item.region}</strong>
              <span className={`severity severity-${item.severity.toLowerCase()}`}>{item.severity}</span>
            </div>
            <p>{item.summary}</p>
            <div className="sitrep-meta">
              <span>{item.incidents} alerts</span>
              <span>
                {item.lat.toFixed(2)}, {item.lon.toFixed(2)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function NewsPanel({ agent }) {
  return (
    <div className="intel-panel">
      <SectionHeader
        eyebrow="News Feed Panel"
        title="Global event stream"
        body={`Trend: ${agent.trend}. Source: ${agent.data.source}. Headlines refresh every 60 seconds.`}
      />
      <PanelStatus agent={agent} emptyLabel="headline stream" />
      <div className="news-list">
        {(agent.data.items.length ? agent.data.items : [{ id: "loading-news-1" }, { id: "loading-news-2" }, { id: "loading-news-3" }]).map((item) => (
          <article className="news-card" key={item.id}>
            {item.title ? (
              <>
                <div className="news-meta">
                  <span>{item.source}</span>
                  <span>{formatTime(item.publishedAt)}</span>
                </div>
                <h3>{item.title}</h3>
                <a href={item.url} target="_blank" rel="noreferrer">
                  Open headline
                </a>
              </>
            ) : (
              <div className="skeleton-card">
                <div className="skeleton-line skeleton-short" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-medium" />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function ConversionBanner({
  tier,
  leadEmail,
  leadBusy,
  onLeadChange,
  onLeadSubmit,
  onUnlockPro,
  onGoElite,
  onGetAccess
}) {
  return (
    <section className="conversion-banner">
      <div className="conversion-copy">
        <p className="eyebrow">Premium Access</p>
        <h2>AI System Generating Signals, Content, and Opportunities — Daily</h2>
        <p>
          Upgrade to unlock full intelligence and real-time access.
        </p>
        <div className="urgency-stack">
          <div className="urgency-pill">Real-time signals locked</div>
          <div className="urgency-pill">Premium intelligence delayed</div>
          <div className="urgency-pill">Upgrade to unlock now</div>
        </div>
        <form className="micro-capture-form" onSubmit={onLeadSubmit}>
          <input
            className="auth-input"
            type="email"
            value={leadEmail}
            onChange={(event) => onLeadChange(event.target.value)}
            placeholder="Enter email to save your access"
            required
          />
          <button className="ghost-button" type="submit" disabled={leadBusy}>
            {leadBusy ? "Saving..." : "Save your access"}
          </button>
        </form>
      </div>
      <div className="conversion-actions">
        <button className="primary-button" type="button" onClick={onUnlockPro}>
          Upgrade to Pro ($49)
        </button>
        <button className="ghost-button" type="button" onClick={onGoElite}>
          Go Elite ($99)
        </button>
        <button className="ghost-button" type="button" onClick={onGetAccess}>
          Get Intelligence Access
        </button>
        <div className="status-chip">Current tier: {tier}</div>
      </div>
    </section>
  );
}

function LeadCapturePanel({ email, status, onEmailChange, onSubmit, analytics }) {
  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Lead Capture"
        title="Get 3 free intelligence signals daily"
        body="Join the free list and receive a daily sample of the signal stack while premium alerts remain reserved for paid operators."
      />
      <form className="lead-form" onSubmit={onSubmit}>
        <input
          className="auth-input"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="Enter your email"
          required
        />
        <button className="primary-button" type="submit">
          Get Free Signals
        </button>
      </form>
      <div className="status-row status-row-wrap">
        <div className="status-chip">Lead submissions: {analytics.leadSubmissions}</div>
        <div className="status-chip">CTA clicks: {analytics.ctaClicks}</div>
      </div>
      {status ? <p className="lead-note">{status}</p> : null}
    </section>
  );
}

function PremiumLockCard({ title, body, onUnlock }) {
  return (
    <article className="premium-lock-card">
      <p className="eyebrow">Premium Locked</p>
      <h3>{title}</h3>
      <p>{body}</p>
      <button className="primary-button" type="button" onClick={onUnlock}>
        Unlock Full Intelligence
      </button>
    </article>
  );
}

function LockedPanelOverlay({ onUnlock }) {
  return (
    <div className="locked-panel-overlay">
      <strong>Upgrade to access full system</strong>
      <p>Upgrade for real-time signals, advanced analytics, and premium agent outputs.</p>
      <button className="primary-button" type="button" onClick={onUnlock}>
        Unlock full access
      </button>
    </div>
  );
}

function SocialProofPanel({ analytics, revenue }) {
  const activeSubscribers = Number(revenue?.activeSubscribers || 0);
  const leadSubmissions = Number(analytics?.leadSubmissions || 0);
  const upgradeIntent = Number(analytics?.ctaClicks || 0);

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Live Conversion Signals"
        title="System momentum"
        body="These counters are sourced from the live platform payload instead of fixed social proof placeholders."
      />
      <div className="proof-grid">
        <article className="proof-card">
          <strong>{activeSubscribers.toLocaleString()}</strong>
          <span>Active paying subscribers</span>
        </article>
        <article className="proof-card">
          <strong>{leadSubmissions.toLocaleString()}</strong>
          <span>Captured leads</span>
        </article>
        <article className="proof-card">
          <strong>{upgradeIntent.toLocaleString()}</strong>
          <span>Upgrade-intent clicks</span>
        </article>
      </div>
    </section>
  );
}

function ActivityFeedPanel({ feed, loading, error, locked, onUnlock, session }) {
  const state = getPanelState({
    loading,
    error,
    items: feed,
    requiresAuth: true,
    session
  });

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Live Activity Feed"
        title="Operational activity stream"
        body="Realtime platform actions from the backend activity stream."
      />
      <PanelStateNotice
        state={state}
        loadingLabel="Loading platform activity..."
        error={error}
        emptyLabel="No live activity yet. Events will appear here after traffic and automation runs."
        authLabel="Sign in to view your personalized activity stream."
      />
      <div className={`locked-panel-shell ${locked ? "is-locked" : ""}`}>
        <div className="activity-feed">
          {feed.map((item) => (
            <article className={`activity-card activity-${item.level}`} key={item.id}>
              <div className="alert-head">
                <strong>{item.actor}</strong>
                <AlertBadge level={item.level === "normal" ? "normal" : item.level} />
              </div>
              <p>{item.action}</p>
              <span>{item.detail}</span>
              <div className="alert-meta">
                <span>Live system event</span>
                <span>{formatTime(item.timestamp)}</span>
              </div>
            </article>
          ))}
        </div>
        {locked ? <LockedPanelOverlay onUnlock={onUnlock} /> : null}
      </div>
      <SectionCtaBar body="Upgrade now to unlock the live activity feed." onUpgrade={onUnlock} />
    </section>
  );
}

function AgentSuitePanel({ agents, tier, onUnlock, loading, error, locked, session }) {
  const state = getPanelState({
    loading,
    error,
    items: agents,
    requiresAuth: true,
    session
  });

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="AI Automation System"
        title="Internal agent suite"
        body="Content, marketing, traffic, intelligence, conversion, and analytics agents feed the platform with operational outputs."
      />
      <PanelStateNotice
        state={state}
        loadingLabel="Loading agent outputs..."
        error={error}
        emptyLabel="No agent outputs are available yet. Generate or refresh intelligence to populate this panel."
        authLabel="Sign in to view account-linked agent output and premium automation state."
      />
      <div className={`locked-panel-shell ${locked ? "is-locked" : ""}`}>
        <div className="agent-grid">
          {agents.map((agent) =>
            agent.locked ? (
              <PremiumLockCard
                key={agent.id}
                title={`${agent.name} locked`}
                body={`${agent.minTier.toUpperCase()} access is required to view this agent's outputs and metrics.`}
                onUnlock={onUnlock}
              />
            ) : (
              <article className="agent-card" key={agent.id}>
                <div className="alert-head">
                  <strong>{agent.name}</strong>
                  <span className="status-chip">{agent.status}</span>
                </div>
                <p>{agent.summary}</p>
                <div className="agent-output">
                  <label>Latest Output</label>
                  <p>{agent.output}</p>
                </div>
                <div className="agent-metric">
                  <span>{agent.metricLabel}</span>
                  <strong>{agent.metricValue}</strong>
                </div>
                <div className="alert-meta">
                  <span>Visible to {agent.minTier}+</span>
                  <span>{hasTierAccess(tier, agent.minTier) ? "Unlocked" : "Upgrade required"}</span>
                </div>
              </article>
            )
          )}
        </div>
        {locked ? <LockedPanelOverlay onUnlock={onUnlock} /> : null}
      </div>
      <SectionCtaBar body="Upgrade now to access full agent output and automation depth." onUpgrade={onUnlock} />
    </section>
  );
}

function RevenueCommandPanel({ revenue, analytics, briefing, premium, onUnlock, loading, error, locked, session }) {
  const state = getPanelState({
    loading,
    error,
    items: revenue ? [revenue] : [],
    requiresAuth: false,
    session
  });

  return (
    <section className="dashboard-grid">
      <section className="panel">
        <SectionHeader
          eyebrow="Revenue Command"
          title="Monetization posture"
          body="Subscription velocity, conversion pressure, and projected revenue are surfaced here for operator decisions."
        />
        <PanelStateNotice
          state={state}
          loadingLabel="Loading revenue posture..."
          error={error}
          emptyLabel="Revenue metrics will appear after lead capture and subscription events sync."
          authLabel="Sign in to load your account revenue posture and premium conversion state."
        />
        <div className={`locked-panel-shell ${locked ? "is-locked" : ""}`}>
          {revenue ? (
            <div className="revenue-grid">
              <MetricCard
                label="MRR"
                value={`$${Number(revenue.monthlyRecurringRevenue || 0).toLocaleString()}`}
                detail="Live recurring revenue from the dashboard payload"
              />
              <MetricCard
                label="Subscribers"
                value={Number(revenue.activeSubscribers || 0).toLocaleString()}
                detail="Active paying users"
              />
              <MetricCard
                label="Conv. Rate"
                value={`${Number(revenue.conversionRate || 0).toFixed(1)}%`}
                detail="Upgrade conversion"
              />
              <MetricCard
                label="Lead Submissions"
                value={Number(analytics?.leadSubmissions || 0).toLocaleString()}
                detail="Captured prospect demand"
              />
              <MetricCard
                label="CTA Clicks"
                value={Number(analytics?.ctaClicks || 0).toLocaleString()}
                detail="Tracked upgrade intent"
              />
            </div>
          ) : (
            <div className="panel-note">Revenue data will appear after the dashboard payload loads.</div>
          )}
          {locked ? <LockedPanelOverlay onUnlock={onUnlock} /> : null}
          </div>
        {!premium?.prioritySignals ? (
          <div className="tier-callout">
            <strong>Elite priority signals locked</strong>
            <p>Elite unlocks the deepest revenue diagnostics and first-line escalation intelligence.</p>
            <button className="ghost-button" type="button" onClick={onUnlock}>
              Upgrade To Elite
            </button>
          </div>
        ) : null}
        <SectionCtaBar body="Upgrade now to unlock advanced analytics and revenue posture." onUpgrade={onUnlock} />
      </section>

      <section className="panel">
        <SectionHeader
          eyebrow="Daily Brief"
          title={briefing?.title || "Daily Brief"}
          body="This summary is generated for the current tier and reflects the platform's current revenue and intelligence posture."
        />
        <div className="brief-card">
          <p>{briefing?.summary || "Waiting for the latest platform briefing..."}</p>
          <div className="brief-actions">
            {briefing?.actions?.map((action) => (
              <div className="brief-action" key={action}>
                {action}
              </div>
            ))}
          </div>
        </div>
        <SectionCtaBar body="Unlock full access to keep premium intelligence live." onUpgrade={onUnlock} />
      </section>
    </section>
  );
}

function UpgradeModal({ open, pricing, tier, onClose, onCheckout, session, authState }) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="upgrade-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="upgrade-modal-header">
          <div>
            <p className="eyebrow">Upgrade Access</p>
            <h2>Unlock full intelligence now</h2>
            <p className="section-copy">
              Free users see limited intelligence mode. Pro and Elite remove action locks and unlock faster high-threat visibility.
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="tier-grid">
          {pricing.filter((plan) => plan.id !== "free").map((plan) => (
            <article
              className={`tier-card ${tier === plan.id ? "tier-card-active" : ""} ${plan.id === "pro" ? "tier-card-featured" : ""}`}
              key={plan.id}
            >
              <p className="eyebrow">{plan.name}</p>
              {plan.id === "pro" ? <span className="most-popular-badge">Most Popular</span> : null}
              <h3>{plan.displayPrice}</h3>
              <strong>{plan.features[0]}</strong>
              <p>{plan.features.slice(1).join(" · ")}</p>
              <button className="primary-button" type="button" onClick={() => onCheckout(plan.id)} disabled={!session}>
                {session ? `Upgrade to ${plan.name}` : authState === AUTH_STATES.confirmationNeeded ? "Confirm email to upgrade" : "Sign in to upgrade"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckoutReturnPanel({ checkoutState, onRetryCheckout, onRetrySync, onDismiss, subscriptionRefreshState, subscriptionRefreshAttempt }) {
  if (!checkoutState) {
    return null;
  }

  if (checkoutState === "success") {
    return (
      <section className="panel">
        <SectionHeader
          eyebrow="Checkout Success"
          title="Billing activated"
          body="Your Stripe checkout completed. The app is refreshing subscription access from the backend now."
        />
        <div className="status-row status-row-wrap">
          <div className="status-chip">Success</div>
          <div className="status-chip">
            {subscriptionRefreshState === "synced" ? "Premium access unlocked" : "Refreshing subscription state"}
          </div>
          {subscriptionRefreshAttempt > 0 ? <div className="status-chip">Attempt {subscriptionRefreshAttempt}</div> : null}
          {subscriptionRefreshState === "pending" ? <div className="status-chip">Waiting for webhook reconciliation</div> : null}
        </div>
        <div className="hero-actions">
          {subscriptionRefreshState !== "synced" ? (
            <button className="ghost-button" type="button" onClick={onRetrySync}>
              Retry subscription refresh
            </button>
          ) : null}
          <button className="primary-button" type="button" onClick={onDismiss}>
            Continue to dashboard
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Checkout Canceled"
        title="No billing changes applied"
        body="Stripe checkout was canceled before completion. Your current plan remains unchanged."
      />
      <div className="status-row status-row-wrap">
        <div className="status-chip">Canceled</div>
        <div className="status-chip">Plan unchanged</div>
      </div>
      <div className="hero-actions">
        <button className="primary-button" type="button" onClick={onRetryCheckout}>
          Try upgrade again
        </button>
        <button className="ghost-button" type="button" onClick={onDismiss}>
          Stay on current plan
        </button>
      </div>
    </section>
  );
}

function AuthPanel({
  authState,
  authFeedbackState,
  authMode,
  email,
  password,
  recoveryPassword,
  recoveryPasswordConfirm,
  authBusy,
  authError,
  authNotice,
  signupCooldown,
  resendCooldown,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onRecoveryPasswordChange,
  onRecoveryPasswordConfirmChange,
  onSubmit,
  onForgotPassword,
  onConfirmationRetry,
  onResendConfirmation,
  enabled
}) {
  const isConfirmationState = authState === AUTH_STATES.confirmationNeeded;
  const isRecoveryState = authState === AUTH_STATES.passwordRecovery || authMode === "recovery";
  const isSignupCoolingDown = authMode === "signup" && signupCooldown > 0;

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="User Auth"
        title="Supabase access"
        body={
          enabled
            ? isConfirmationState
              ? "Account created. Confirm your email, then return here to continue."
              : isRecoveryState
                ? "Reset your password here, then return to the normal sign-in flow."
              : "Sign in to persist alerts, unlock subscriptions, and personalize intelligence."
            : "Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable auth."
        }
      />
      <div className="status-row status-row-wrap">
        <div className="status-chip">
          Auth state: {authState === AUTH_STATES.signedIn ? "Signed in" : isConfirmationState ? "Email confirmation needed" : isRecoveryState ? "Password reset" : "Signed out"}
        </div>
        {authFeedbackState === AUTH_FEEDBACK_STATES.emailSent ? <div className="status-chip">Email sent</div> : null}
        {isConfirmationState ? <div className="status-chip">Waiting confirmation</div> : null}
        {isRecoveryState ? <div className="status-chip">Recovery active</div> : null}
        {authFeedbackState === AUTH_FEEDBACK_STATES.error ? <div className="status-chip">Error</div> : null}
      </div>
      <div className="auth-choice-grid">
        <article className={`auth-choice-card ${authMode === "signin" && !isRecoveryState ? "is-selected" : ""}`}>
          <div className="auth-choice-copy">
            <p className="eyebrow">Returning user</p>
            <h3>Sign In</h3>
            <p>Use your existing account to unlock saved alerts, paid access, and checkout recovery.</p>
          </div>
          <div className="auth-choice-actions">
            <button className={authMode === "signin" && !isRecoveryState ? "primary-button" : "ghost-button"} type="button" onClick={() => onModeChange("signin")}>
              Use Sign In
            </button>
            <button className="text-button" type="button" onClick={onForgotPassword} disabled={!enabled || authBusy}>
              Forgot password?
            </button>
          </div>
        </article>
        <article className={`auth-choice-card ${authMode === "signup" ? "is-selected" : ""}`}>
          <div className="auth-choice-copy">
            <p className="eyebrow">New user</p>
            <h3>Create Account</h3>
            <p>Create a separate account flow for first-time access and email confirmation.</p>
          </div>
          <div className="auth-choice-actions">
            <button className={authMode === "signup" ? "primary-button" : "ghost-button"} type="button" onClick={() => onModeChange("signup")}>
              Use Create Account
            </button>
          </div>
        </article>
      </div>
      <form className="auth-form" onSubmit={onSubmit}>
        <input className="auth-input" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="Email" required disabled={!enabled || authBusy} />
        {isRecoveryState ? (
          <>
            <input
              className="auth-input"
              type="password"
              value={recoveryPassword}
              onChange={(event) => onRecoveryPasswordChange(event.target.value)}
              placeholder="New password"
              required
              disabled={!enabled || authBusy}
            />
            <input
              className="auth-input"
              type="password"
              value={recoveryPasswordConfirm}
              onChange={(event) => onRecoveryPasswordConfirmChange(event.target.value)}
              placeholder="Confirm new password"
              required
              disabled={!enabled || authBusy}
            />
          </>
        ) : (
          <input className="auth-input" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Password" required disabled={!enabled || authBusy} />
        )}
        {authNotice ? <p className="panel-note">{authNotice}</p> : null}
        {authError ? <p className="auth-error">{authError}</p> : null}
        <button className="primary-button" type="submit" disabled={!enabled || authBusy || isSignupCoolingDown}>
          {authBusy
            ? "Working..."
            : isRecoveryState
              ? "Save New Password"
              : authMode === "signin"
                ? "Sign In"
                : isSignupCoolingDown
                  ? `Create Account (${signupCooldown}s)`
                  : "Create Account"}
        </button>
        {isConfirmationState ? (
          <button className="ghost-button" type="button" onClick={onConfirmationRetry} disabled={!enabled || authBusy}>
            I confirmed my email, continue
          </button>
        ) : null}
        {isConfirmationState ? (
          <button className="ghost-button" type="button" onClick={onResendConfirmation} disabled={!enabled || authBusy || resendCooldown > 0 || !email}>
            {resendCooldown > 0 ? `Resend confirmation (${resendCooldown}s)` : "Resend confirmation email"}
          </button>
        ) : null}
      </form>
    </section>
  );
}

function SubscriptionPanel({ pricing, tier, subscription, onCheckout, session, authState }) {
  const account = normalizeSubscriptionState(subscription, tier);

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Subscription Tiers"
        title="Monetized intelligence access"
        body="High-threat alerts are delayed for free users. Pro unlocks full access. Elite gets priority signals and first-line escalation."
      />
      <div className="tier-grid">
        {pricing.map((plan) => (
          <article
            className={`tier-card ${tier === plan.id ? "tier-card-active" : ""} ${plan.id === "pro" ? "tier-card-featured" : ""}`}
            key={plan.id}
          >
            <p className="eyebrow">{plan.name}</p>
            {plan.id === "pro" ? <span className="most-popular-badge">Most Popular</span> : null}
            <h3>{plan.displayPrice}</h3>
            <strong>{plan.features[0]}</strong>
            <p>{plan.features.slice(1).join(" · ")}</p>
            <ul className="tier-feature-list">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            {plan.id === "free" ? (
              <button className="ghost-button" type="button" disabled>
                Free Active
              </button>
            ) : account.paid && account.tier === plan.id ? (
              <button className="ghost-button" type="button" disabled>
                {getSubscriptionStatusLabel(account.status)}
              </button>
            ) : (
              <button className="ghost-button" type="button" onClick={() => onCheckout(plan.id)} disabled={!session}>
                {session ? `Upgrade to ${plan.name}` : authState === AUTH_STATES.confirmationNeeded ? "Confirm email to upgrade" : "Sign in to upgrade"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function UserPanel({ session, tier, subscription, onSignOut, historyCount }) {
  const account = normalizeSubscriptionState(subscription, tier);

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="User Dashboard"
        title="Account intelligence"
        body="Per-user alert history, subscription access, and paid API visibility."
        action="Sign Out"
        onAction={onSignOut}
      />
      <div className="user-grid">
        <article className="memory-card">
          <strong>{session?.user?.email || "Guest"}</strong>
          <span>Tier: {account.tier}</span>
          <span>{account.paid ? "Paid access enabled" : "Free users see limited intelligence mode"}</span>
        </article>
        <article className="memory-card">
          <strong>Account Status</strong>
          <span>{getSubscriptionStatusLabel(account.status)}</span>
          <span>{account.currentPeriodEnd ? `Current period ends ${formatDateTime(account.currentPeriodEnd)}` : "No paid billing period on file"}</span>
        </article>
        <article className="memory-card">
          <strong>/api/alerts</strong>
          <span>{account.paid ? "Full alert payloads" : "High-threat alerts are delayed for free users"}</span>
          <span>{account.tier === "elite" ? "Priority signals enabled" : "Priority signals locked"}</span>
        </article>
        <article className="memory-card">
          <strong>History</strong>
          <span>{historyCount} alerts loaded</span>
          <span>{account.paid ? "Billing active" : "Upgrade to unlock more"}</span>
        </article>
      </div>
    </section>
  );
}

function AccountStatusPanel({ subscription, session, authState, onManageBilling, billingPortalBusy, subscriptionRefreshState, subscriptionRefreshAttempt }) {
  const account = normalizeSubscriptionState(subscription, subscription?.tier || "free");
  const hasBillingRecord = Boolean(account.stripeCustomerId || account.stripeSubscriptionId);
  const authStateLabel = getAuthStateLabel(authState);
  const billingStateLabel = getBillingStateLabel(account);

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Account Status"
        title="Current plan state"
        body="This panel reflects the auth session and the latest subscription record loaded from the backend."
      />
      <div className="status-row status-row-wrap">
        <div className="status-chip">Plan: {account.tier.toUpperCase()}</div>
        <div className="status-chip">Subscription: {getSubscriptionStatusLabel(account.status)}</div>
        <div className="status-chip">Auth: {authStateLabel}</div>
        <div className="status-chip">Billing: {billingStateLabel}</div>
        {subscriptionRefreshState === "refreshing" ? <div className="status-chip">Sync attempt {subscriptionRefreshAttempt}</div> : null}
      </div>
      <div className="user-grid">
        <article className="memory-card">
          <strong>{account.tier.toUpperCase()}</strong>
          <span>Plan tier</span>
          <span>{account.paid ? "Premium UI unlocked" : "Premium UI locked"}</span>
        </article>
        <article className="memory-card">
          <strong>{getSubscriptionStatusLabel(account.status)}</strong>
          <span>Billing status</span>
          <span>{account.currentPeriodEnd ? `Ends ${formatDateTime(account.currentPeriodEnd)}` : "No active billing period"}</span>
        </article>
        <article className="memory-card">
          <strong>{authStateLabel}</strong>
          <span>Auth state</span>
          <span>{session?.user?.email || "Guest session"}</span>
        </article>
        <article className="memory-card">
          <strong>{billingStateLabel}</strong>
          <span>{hasBillingRecord ? "Billing profile found" : "No Stripe customer or subscription record returned yet"}</span>
          <button className="ghost-button" type="button" onClick={onManageBilling} disabled={!session || billingPortalBusy}>
            {billingPortalBusy ? "Opening billing..." : "Manage billing"}
          </button>
        </article>
      </div>
    </section>
  );
}

function AlertFeedPanel({ alerts, lockedCount, tier, onClear, persistence, webhook }) {
  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Notification Panel"
        title="ARCHAIOS ALERT FEED"
        body="High-threat alerts are delayed for free users. Paid users can see high-level alerts in real time."
        action="CLEAR ALERTS"
        onAction={onClear}
      />
      <div className="status-row status-row-wrap">
        <div className="status-chip">Tier: {tier}</div>
        <div className="status-chip">Supabase: {persistence.enabled ? `saved ${persistence.saved}` : "disabled"}</div>
        <div className="status-chip">Webhook: {webhook.enabled ? `sent ${webhook.sent}` : "disabled"}</div>
        {!hasPaidAccess(tier) && lockedCount > 0 ? (
          <div className="status-chip">{lockedCount} delayed high-threat alerts locked behind Pro</div>
        ) : null}
      </div>
      <div className="alert-feed">
        {alerts.map((alert) => (
          <article className={`alert-card alert-card-${alert.level}`} key={alert.id}>
            <div className="alert-head">
              <strong>{alert.title}</strong>
              <AlertBadge level={alert.level} />
            </div>
            <p>{alert.message}</p>
            <div className="alert-meta">
              <span>{alert.source}</span>
              <span>{formatTime(alert.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AlertHistoryPanel({ history, tier }) {
  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Alert History"
        title="Per-user alert archive"
        body="The last 50 alerts are loaded through the paid /api/alerts endpoint and filtered by subscription tier."
      />
      <div className="history-list">
        {history.map((item) => (
          <article className="history-card" key={item.id}>
            <div className="alert-head">
              <strong>{item.type}</strong>
              <AlertBadge level={item.severity} />
            </div>
            <p>{item.message}</p>
            <div className="alert-meta">
              <span>Tier view: {tier}</span>
              <span>{formatTime(item.timestamp)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [system, setSystem] = useState(() => loadSystemState());
  const [intelligence, setIntelligence] = useState(createIntelligenceSeed);
  const [platformDashboard, setPlatformDashboard] = useState(createPlatformSeed);
  const [session, setSession] = useState(null);
  const [tier, setTier] = useState("free");
  const [subscription, setSubscription] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authState, setAuthState] = useState(AUTH_STATES.signedOut);
  const [authFeedbackState, setAuthFeedbackState] = useState(AUTH_FEEDBACK_STATES.idle);
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingCheckoutTier, setPendingCheckoutTier] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(PENDING_CHECKOUT_KEY) || "";
  });
  const [leadEmail, setLeadEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState("");
  const [leadBusy, setLeadBusy] = useState(false);
  const [contentActionStatus, setContentActionStatus] = useState("");
  const [platformBusy, setPlatformBusy] = useState(true);
  const [platformError, setPlatformError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutState, setCheckoutState] = useState(() => getCheckoutStateFromLocation());
  const [checkoutResultView, setCheckoutResultView] = useState(() => getCheckoutStateFromLocation());
  const [checkoutSyncState, setCheckoutSyncState] = useState("idle");
  const [checkoutSyncAttempt, setCheckoutSyncAttempt] = useState(0);
  const [checkoutSyncKey, setCheckoutSyncKey] = useState(0);
  const [billingPortalBusy, setBillingPortalBusy] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [activeDate, setActiveDate] = useState(() => loadSystemState().calendar[0].date);
  const notifiedRef = useRef(new Set());
  const leadCaptureRef = useRef(null);
  const checkoutRetryRef = useRef(false);
  const effectiveSubscription = normalizeSubscriptionState(subscription, tier);
  const isFreeTier = !effectiveSubscription.paid;
  const pricingTiers = platformDashboard.pricing?.length ? platformDashboard.pricing : PRICING_TIERS;
  const showAuthPanel = !session || authState === AUTH_STATES.passwordRecovery;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(system));
  }, [system]);

  useEffect(() => {
    getCurrentSession().then(setSession);
    if (urlIncludesRecoveryToken()) {
      setAuthState(AUTH_STATES.passwordRecovery);
      setAuthMode("recovery");
      setAuthNotice("Recovery link detected. Set a new password to finish resetting access.");
    }

    const authListener = subscribeToAuthChanges((event, nextSession) => {
      setSession(nextSession);

      if (event === "PASSWORD_RECOVERY") {
        setAuthState(AUTH_STATES.passwordRecovery);
        setAuthMode("recovery");
        setAuthError("");
        setAuthNotice("Recovery verified. Set a new password, then sign back in.");
      }
    });
    return () => authListener.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!checkoutState) {
      return;
    }

    if (checkoutState === "success") {
      setCheckoutNotice("Checkout completed. Subscription status is refreshing.");
      setAuthNotice("Checkout completed. Refreshing your subscription access.");
      setPendingCheckoutTier("");
      setCheckoutResultView("success");
      setCheckoutSyncState("refreshing");
      setCheckoutSyncAttempt(0);
      setCheckoutSyncKey((current) => current + 1);
      trackRevenueEvent("checkout_success", {
        location: "checkout-return",
        tier,
        requestedTier: pendingCheckoutTier || tier,
        authState
      }).catch(() => null);
    }

    if (checkoutState === "cancel") {
      setCheckoutNotice("");
      setCheckoutError("Checkout was canceled. Your plan has not changed.");
      setCheckoutResultView("cancel");
      setCheckoutSyncState("idle");
      setCheckoutSyncAttempt(0);
      trackRevenueEvent("checkout_cancel", {
        location: "checkout-return",
        tier,
        requestedTier: pendingCheckoutTier || tier,
        authState
      }).catch(() => null);
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }

    setCheckoutState("");
  }, [authState, checkoutState, pendingCheckoutTier, tier]);

  const refreshUserAccess = async () => {
    if (!session?.user?.id || !session?.access_token) {
      return null;
    }

    const [serverSubscription, fallbackTier] = await Promise.all([
      fetchSubscription(session.access_token).catch(() => null),
      getUserTier(session.user.id).catch(() => "free")
    ]);

    const normalizedServerSubscription = serverSubscription ? normalizeSubscriptionState(serverSubscription, fallbackTier) : null;
    const resolvedTier = normalizedServerSubscription?.tier || fallbackTier || "free";
    const nextSubscription =
      normalizedServerSubscription || {
        tier: resolvedTier,
        status: hasPaidAccess(resolvedTier) ? "active" : "free",
        paid: hasPaidAccess(resolvedTier)
      };

    setTier(resolvedTier);
    setSubscription(nextSubscription);
    return nextSubscription;
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (pendingCheckoutTier) {
      window.localStorage.setItem(PENDING_CHECKOUT_KEY, pendingCheckoutTier);
      return;
    }

    window.localStorage.removeItem(PENDING_CHECKOUT_KEY);
  }, [pendingCheckoutTier]);

  useEffect(() => {
    if (signupCooldown <= 0 && resendCooldown <= 0) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setSignupCooldown((current) => Math.max(current - 1, 0));
      setResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [resendCooldown, signupCooldown]);

  useEffect(() => {
    if (session?.user?.id) {
      setAuthState((current) => (current === AUTH_STATES.passwordRecovery ? current : AUTH_STATES.signedIn));
      setAuthError("");
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.idle);
      return;
    }

    setAuthState((current) => (current === AUTH_STATES.confirmationNeeded || current === AUTH_STATES.passwordRecovery ? current : AUTH_STATES.signedOut));
  }, [session?.user?.id]);

  useEffect(() => {
    async function loadSubscriptionState() {
      if (!session?.user?.id) {
        setTier("free");
        setSubscription(null);
        setCheckoutSyncState("idle");
        setCheckoutSyncAttempt(0);
        setIntelligence((current) => ({ ...current, history: [] }));
        return;
      }

      await refreshUserAccess();
    }

    loadSubscriptionState();
  }, [checkoutState, session]);

  useEffect(() => {
    if (checkoutResultView !== "success" || !session?.access_token || checkoutSyncKey === 0) {
      return;
    }

    let cancelled = false;

    async function syncAccessAfterCheckout() {
      setCheckoutSyncState("refreshing");

      for (let attempt = 0; attempt < CHECKOUT_SYNC_DELAYS_MS.length; attempt += 1) {
        setCheckoutSyncAttempt(attempt + 1);

        if (CHECKOUT_SYNC_DELAYS_MS[attempt] > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, CHECKOUT_SYNC_DELAYS_MS[attempt]));
        }

        const nextSubscription = await refreshUserAccess();
        if (cancelled) {
          return;
        }

        if (nextSubscription?.paid) {
          setCheckoutSyncState("synced");
          setCheckoutNotice("Checkout completed. Premium access is now unlocked.");
          await fetchAllData(nextSubscription.tier);
          return;
        }

        setCheckoutSyncState("pending");
        setCheckoutNotice(`Checkout completed. Waiting for billing sync from Stripe webhook. Attempt ${attempt + 1} of ${CHECKOUT_SYNC_DELAYS_MS.length}.`);
      }

      if (!cancelled) {
        setCheckoutSyncState("pending");
        setCheckoutNotice("Checkout completed. Payment returned successfully, but subscription reconciliation is still pending.");
      }
    }

    syncAccessAfterCheckout();

    return () => {
      cancelled = true;
    };
  }, [checkoutResultView, checkoutSyncKey, session?.access_token]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const visibleAlerts = useMemo(
    () => filterVisibleAlerts(intelligence.alerts, tier),
    [intelligence.alerts, tier]
  );

  const lockedHighCount = useMemo(
    () => intelligence.alerts.filter((alert) => alert.level === "high").length - visibleAlerts.filter((alert) => alert.level === "high").length,
    [intelligence.alerts, visibleAlerts]
  );

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !hasPaidAccess(tier)) {
      return;
    }

    visibleAlerts
      .filter((alert) => alert.level === "high")
      .forEach((alert) => {
        if (notifiedRef.current.has(alert.id)) {
          return;
        }

        new Notification(`ARCHAIOS: ${alert.title}`, {
          body: alert.message,
          tag: alert.id
        });
        notifiedRef.current.add(alert.id);
      });
  }, [visibleAlerts, tier]);

  const postsForDate = useMemo(
    () => system.posts.filter((post) => post.date === activeDate),
    [activeDate, system.posts]
  );

  const channelGroups = useMemo(
    () =>
      CHANNELS.map((channel) => ({
        channel,
        posts: postsForDate.filter((post) => post.channel === channel)
      })),
    [postsForDate]
  );

  const fetchAllData = async (tierOverride) => {
    setIntelligence((current) => ({
      ...current,
      isRefreshing: true,
      market: current.generatedAt ? current.market : { ...current.market, status: "loading", error: null },
      news: current.generatedAt ? current.news : { ...current.news, status: "loading", error: null },
      sitrep: current.generatedAt ? current.sitrep : { ...current.sitrep, status: "loading", error: null }
    }));
    setPlatformBusy(true);
    setPlatformError("");

    const accessToken = session?.access_token || null;
    const userId = session?.user?.id || null;
    const effectiveTierForFetch = tierOverride || tier;

    const [agentResult, alertPayload, dashboardResult] = await Promise.all([
      runIntelligenceAgents({ userId, tier: effectiveTierForFetch }),
      accessToken ? fetchUserAlerts(accessToken).catch(() => null) : Promise.resolve(null),
      fetchPlatformDashboard(accessToken)
        .then((payload) => ({ payload, error: "" }))
        .catch((error) => ({
          payload: null,
          error: String(error?.message || error || "Platform dashboard request failed")
        }))
    ]);

    setIntelligence({
      ...agentResult,
      history: alertPayload?.alerts || [],
      isRefreshing: false
    });

    if (dashboardResult.payload) {
      setPlatformDashboard(dashboardResult.payload);
      setPlatformError("");
    } else if (dashboardResult.error) {
      setPlatformError(withHealthcheckHint(dashboardResult.error));
    }

    setPlatformBusy(false);
  };

  useEffect(() => {
    fetchAllData();
    const intervalId = window.setInterval(fetchAllData, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [session?.user?.id, tier]);

  useEffect(() => {
    if (!session?.access_token) {
      checkoutRetryRef.current = false;
      return;
    }

    if (!pendingCheckoutTier || checkoutRetryRef.current) {
      return;
    }

    checkoutRetryRef.current = true;
    setAuthNotice("Email confirmed. Resuming checkout.");
    handleCheckout(pendingCheckoutTier, { autoRetry: true }).catch(() => {});
  }, [pendingCheckoutTier, session?.access_token]);

  useEffect(() => {
    if (effectiveSubscription.paid) {
      setIsUpgradeModalOpen(false);
    }
  }, [effectiveSubscription.paid]);

  const handleModeChange = (nextMode) => {
    setAuthMode(nextMode);
    setAuthError("");
    setAuthNotice("");
    setAuthFeedbackState(AUTH_FEEDBACK_STATES.idle);
    setPassword("");
    setRecoveryPassword("");
    setRecoveryPasswordConfirm("");
    setAuthState((current) => {
      if (current === AUTH_STATES.passwordRecovery) {
        return current;
      }

      if (current === AUTH_STATES.confirmationNeeded && nextMode === "signin") {
        return current;
      }

      return current === AUTH_STATES.signedIn ? current : AUTH_STATES.signedOut;
    });
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    setAuthFeedbackState(AUTH_FEEDBACK_STATES.idle);

    try {
      if (authMode === "recovery") {
        if (!recoveryPassword || recoveryPassword.length < 8) {
          throw new Error("Enter a new password with at least 8 characters.");
        }

        if (recoveryPassword !== recoveryPasswordConfirm) {
          throw new Error("New password and confirmation must match.");
        }

        await updatePassword(recoveryPassword);
        setAuthState(AUTH_STATES.signedIn);
        setAuthMode("signin");
        setAuthNotice("Password updated. Sign in with your new password if you are prompted again.");
        setRecoveryPassword("");
        setRecoveryPasswordConfirm("");
      } else if (authMode === "signin") {
        await signIn(email, password);
        setAuthState(AUTH_STATES.signedIn);
        await trackRevenueEvent("signin_success", {
          location: "auth-panel",
          tier,
          authState: AUTH_STATES.signedIn
        });
        setEmail("");
      } else {
        const result = await signUp(email, password);
        if (shouldPreferSignInForSignup(result)) {
          setAuthMode("signin");
          setAuthState(AUTH_STATES.signedOut);
          setAuthNotice("This email already belongs to a confirmed account. Sign in instead, or use Forgot password if needed.");
        } else if (result?.session) {
          setAuthState(AUTH_STATES.signedIn);
          setAuthFeedbackState(AUTH_FEEDBACK_STATES.idle);
          await trackRevenueEvent("signup_success", {
            location: "auth-panel",
            tier,
            authState: AUTH_STATES.signedIn
          });
          setEmail("");
        } else {
          setAuthState(AUTH_STATES.confirmationNeeded);
          setAuthFeedbackState(AUTH_FEEDBACK_STATES.emailSent);
          setAuthMode("signin");
          setSignupCooldown(SIGNUP_COOLDOWN_SECONDS);
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
          await logCtaClick("signup-confirmation-sent", "auth-panel", tier).catch(() => null);
          setAuthNotice(
            pendingCheckoutTier
              ? "Check your inbox, confirm your email, then sign in. Your pending Pro or Elite checkout will resume automatically."
              : "Check your inbox, confirm your email, then sign in."
          );
        }
      }
      setPassword("");
    } catch (error) {
      const authFailure = classifyAuthError(error, authMode);
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.error);
      setAuthError(authFailure.message);

      if (authFailure.kind === "rate-limit" && authMode === "signup") {
        setSignupCooldown(RESEND_COOLDOWN_SECONDS);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }

      if (authFailure.kind === "existing-account") {
        setAuthMode("signin");
        setAuthState(AUTH_STATES.signedOut);
      }

      if (authFailure.kind === "email-not-confirmed") {
        setAuthState(AUTH_STATES.confirmationNeeded);
        setAuthFeedbackState(AUTH_FEEDBACK_STATES.waitingConfirmation);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCheckout = async (requestedTier, options = {}) => {
    setCheckoutNotice("");
    setCheckoutError("");

    try {
      await trackRevenueEvent("upgrade_click", {
        location: options.autoRetry ? "checkout-auto-retry" : "upgrade-modal",
        tier,
        requestedTier,
        authState
      });
      if (!session?.access_token) {
        setPendingCheckoutTier(requestedTier);
        setAuthMode("signin");
        throw new Error(
          authState === AUTH_STATES.confirmationNeeded
            ? "Confirm your email, then sign in to continue to checkout."
            : "Sign in to continue to checkout."
        );
      }

      await trackRevenueEvent("checkout_start", {
        location: options.autoRetry ? "checkout-auto-retry" : "upgrade-modal",
        tier,
        requestedTier,
        authState
      });
      const payload = await startStripeCheckout(session.access_token, requestedTier);
      if (!payload?.url) {
        throw new Error("Checkout session URL missing.");
      }

      setPendingCheckoutTier("");
      setAuthNotice(options.autoRetry ? "Checkout ready. Redirecting now." : "");
      setCheckoutSyncState("idle");
      setCheckoutSyncAttempt(0);
      window.location.href = payload.url;
    } catch (error) {
      setCheckoutError(withHealthcheckHint(String(error?.message || error)));
      if (options.autoRetry) {
        checkoutRetryRef.current = false;
        throw error;
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.error);
      setAuthError("Enter your email, then use Forgot password to send a reset link.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    setAuthFeedbackState(AUTH_FEEDBACK_STATES.idle);

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined;
      await requestPasswordReset(email, redirectTo);
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.emailSent);
      setAuthMode("signin");
      setAuthNotice("Password reset email sent. Open the link from your inbox, then set your new password here.");
    } catch (error) {
      const authFailure = classifyAuthError(error, "signin");
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.error);
      setAuthError(authFailure.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleClearAlerts = async () => {
    if (!session?.access_token) {
      setIntelligence((current) => ({ ...current, history: [] }));
      return;
    }

    await clearUserAlerts(session.access_token);
    setIntelligence((current) => ({ ...current, history: [] }));
  };

  const handleSignOut = async () => {
    setAuthState(AUTH_STATES.signedOut);
    setAuthNotice("");
    setPendingCheckoutTier("");
    await signOut();
  };

  const handleConfirmationRetry = async () => {
    setAuthBusy(true);
    setAuthError("");
    setAuthFeedbackState(AUTH_FEEDBACK_STATES.waitingConfirmation);

    try {
      const nextSession = await getCurrentSession();
      setSession(nextSession);

      if (nextSession?.access_token) {
        setAuthState(AUTH_STATES.signedIn);
        setAuthNotice(pendingCheckoutTier ? "Email confirmed. Continuing to checkout." : "Email confirmed. You are signed in.");
        setAuthFeedbackState(AUTH_FEEDBACK_STATES.idle);
        return;
      }

      setAuthMode("signin");
      setAuthNotice("Email confirmed. Sign in to continue.");
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.waitingConfirmation);
    } catch (error) {
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.error);
      setAuthError(classifyAuthError(error, "signin").message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email || resendCooldown > 0) {
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");

    try {
      const redirectTo = typeof window !== "undefined" ? window.location.origin + window.location.pathname : undefined;
      await resendConfirmationEmail(email, redirectTo);
      setAuthState(AUTH_STATES.confirmationNeeded);
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.emailSent);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setAuthNotice("Confirmation email sent. Check your inbox, then sign in after you confirm.");
    } catch (error) {
      const authFailure = classifyAuthError(error, "signup");
      setAuthFeedbackState(AUTH_FEEDBACK_STATES.error);
      setAuthError(authFailure.message);
      if (authFailure.kind === "rate-limit") {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLeadSubmit = async (event) => {
    event.preventDefault();
    setLeadBusy(true);

    try {
      await captureLead(leadEmail);
      await logCtaClick("lead-submit", "lead-capture", tier).catch(() => null);
      setLeadStatus("You are on the list. Your 3 free intelligence signals will arrive daily.");
      setLeadEmail("");
    } catch (error) {
      setLeadStatus(withHealthcheckHint(String(error?.message || error)));
    } finally {
      setLeadBusy(false);
    }
  };

  const handleLockedAction = (action) => {
    if (isFreeTier) {
      setIsUpgradeModalOpen(true);
      return;
    }

    action();
  };

  const handleGetAccess = async () => {
    await logCtaClick("get-intelligence-access", "conversion-banner", tier).catch(() => null);
    leadCaptureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setLeadStatus("Enter your email below to get intelligence access updates.");
  };

  const handleUnlockPro = async () => {
    await logCtaClick("unlock-pro", "conversion-banner", tier).catch(() => null);
    setIsUpgradeModalOpen(true);
  };

  const handleManageBilling = async () => {
    setCheckoutNotice("");
    setCheckoutError("");

    if (!session?.access_token) {
      setCheckoutError("Sign in to manage billing.");
      return;
    }

    setBillingPortalBusy(true);

    try {
      const returnUrl = typeof window !== "undefined" ? window.location.href : undefined;
      const payload = await createBillingPortalSession(session.access_token, returnUrl);
      const portalUrl = payload?.url || payload?.portalUrl || payload?.billingPortalUrl;

      if (!portalUrl) {
        throw new Error("Billing portal URL missing.");
      }

      window.location.href = portalUrl;
    } catch (error) {
      if (error?.status === 404 || String(error?.message || error).toLowerCase().includes("not found")) {
        setCheckoutError("Stripe customer portal route is not deployed yet. Configure the backend portal endpoint to activate Manage Billing.");
      } else {
        setCheckoutError(withHealthcheckHint(String(error?.message || error)));
      }
    } finally {
      setBillingPortalBusy(false);
    }
  };

  const handleDismissCheckoutResult = () => {
    setCheckoutResultView("");
    setCheckoutSyncState("idle");
    setCheckoutSyncAttempt(0);
  };

  const handleRetryUpgrade = () => {
    setCheckoutResultView("");
    setIsUpgradeModalOpen(true);
  };

  const handleRetrySubscriptionRefresh = () => {
    setCheckoutNotice("Retrying subscription refresh.");
    setCheckoutSyncState("refreshing");
    setCheckoutSyncAttempt(0);
    setCheckoutSyncKey((current) => current + 1);
  };

  const handleCopyPost = async (post) => {
    const copy = [
      `${post.channel} | ${post.title}`,
      `Hook: ${post.hook}`,
      `Caption: ${post.caption}`,
      `Hashtags: ${post.hashtags}`
    ].join("\n");

    try {
      await navigator.clipboard.writeText(copy);
      setContentActionStatus(`${post.shortId} copied for ${post.channel}.`);
    } catch {
      setContentActionStatus("Copy failed. Check clipboard permissions.");
    }
  };

  const handleSharePost = async (post) => {
    const sharePayload = {
      title: post.title,
      text: `${post.hook}\n\n${post.caption}\n\n${post.hashtags}`
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        setContentActionStatus(`${post.shortId} shared.`);
        return;
      }

      await navigator.clipboard.writeText(sharePayload.text);
      setContentActionStatus(`${post.shortId} export copied for sharing.`);
    } catch {
      setContentActionStatus("Share action was cancelled or unavailable.");
    }
  };

  const runAutomation = () => {
    const nextId = system.posts.length + 1;
    const freshPosts = buildPosts(activeDate, { startId: nextId });
    const mergedPosts = [...system.posts.filter((post) => post.date !== activeDate), ...freshPosts];

    setSystem((current) => ({
      ...current,
      generatedAt: new Date().toISOString(),
      posts: mergedPosts,
      performance: summarizePerformance(mergedPosts)
    }));
  };

  const createNextWeek = () => {
    const lastDate = new Date(system.calendar[system.calendar.length - 1].date);

    setSystem((current) => {
      const nextCalendar = [...current.calendar];
      for (let index = 1; index <= 7; index += 1) {
        const date = new Date(lastDate);
        date.setDate(lastDate.getDate() + index);
        nextCalendar.push({
          date: formatDateKey(date),
          label: date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric"
          }),
          focus: CONTENT_PILLARS[(nextCalendar.length + index) % CONTENT_PILLARS.length].label,
          goal: ["Traffic", "Engagement", "Revenue"][(nextCalendar.length + index) % 3]
        });
      }

      return {
        ...current,
        calendar: nextCalendar
      };
    });
  };

  const currentStatus = liveStatus(intelligence);

  return (
    <main className="app-shell">
      <ConversionBanner
        tier={tier}
        leadEmail={leadEmail}
        leadBusy={leadBusy}
        onLeadChange={setLeadEmail}
        onLeadSubmit={handleLeadSubmit}
        onUnlockPro={handleUnlockPro}
        onGoElite={() => handleCheckout("elite")}
        onGetAccess={handleGetAccess}
      />
      <UpgradeModal
        open={isUpgradeModalOpen}
        pricing={pricingTiers}
        tier={effectiveSubscription.tier}
        onClose={() => setIsUpgradeModalOpen(false)}
        onCheckout={handleCheckout}
        session={session}
        authState={authState}
      />
      <CheckoutReturnPanel
        checkoutState={checkoutResultView}
        onRetryCheckout={handleRetryUpgrade}
        onRetrySync={handleRetrySubscriptionRefresh}
        onDismiss={handleDismissCheckoutResult}
        subscriptionRefreshState={checkoutSyncState}
        subscriptionRefreshAttempt={checkoutSyncAttempt}
      />
      {checkoutNotice ? <div className="panel-note">{checkoutNotice}</div> : null}
      {checkoutError ? <div className="panel-note panel-note-error">{checkoutError}</div> : null}
      {platformError ? (
        <div className="panel-note panel-note-error">
          Backend health check:{" "}
          <a href={BACKEND_HEALTHCHECK_URL} rel="noreferrer" target="_blank">
            {BACKEND_HEALTHCHECK_URL}
          </a>
        </div>
      ) : null}
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">{THEME} Monetized Intelligence Platform</p>
          <h1>{BRAND} Live Operations Dashboard</h1>
          <p>
            ARCHAIOS now supports Supabase auth, subscription gating, Stripe billing,
            per-user alert history, and a paid `/api/alerts` flow that limits free
            users while unlocking full and priority access for Pro and Elite.
          </p>
          <div className="hero-actions">
            <button
              className={`primary-button ${isFreeTier ? "button-locked" : ""}`}
              onClick={() => handleLockedAction(runAutomation)}
              type="button"
            >
              {isFreeTier ? "Unlock To Generate Posts" : "Generate Today&apos;s 9 Posts"}
            </button>
            <button
              className={`ghost-button ${isFreeTier ? "button-locked" : ""}`}
              onClick={() => handleLockedAction(fetchAllData)}
              type="button"
            >
              {isFreeTier ? "Unlock To Refresh Intelligence" : "Refresh Intelligence Now"}
            </button>
            <button
              className={`ghost-button ${isFreeTier ? "button-locked" : ""}`}
              onClick={() => handleLockedAction(createNextWeek)}
              type="button"
            >
              {isFreeTier ? "Unlock To Extend Calendar" : "Extend Content Calendar"}
            </button>
          </div>
        </div>

        <div className="hero-status">
          <div className="status-row">
            <StatusIndicator status={currentStatus} label={currentStatus === "live" ? "Live" : "Offline"} />
            <AlertBadge level={intelligence.systemLevel} />
            <div className="status-chip">Tier: {effectiveSubscription.tier}</div>
            <div className="status-chip">Last sync: {formatTime(intelligence.generatedAt)}</div>
            {intelligence.isRefreshing ? <div className="status-chip">Refreshing live feeds...</div> : null}
          </div>
          <div className="status-chip">Auth: {session?.user?.email || "Guest mode"}</div>
          <div className="status-chip">{getAuthStateLabel(authState)}</div>
          <div className="status-chip">Subscription: {getSubscriptionStatusLabel(effectiveSubscription.status)}</div>
          <div className="status-chip">Billing: {getBillingStateLabel(effectiveSubscription)}</div>
          <div className="status-chip">
            Paid access: {effectiveSubscription.paid ? "Unlocked" : "Free users see limited intelligence mode"}
          </div>
          <div className="signal-grid">
            <MetricCard
              label="Engagement"
              value={system.performance.engagement.toLocaleString()}
              detail="Across generated social content"
            />
            <MetricCard
              label="Clicks"
              value={system.performance.clicks.toLocaleString()}
              detail="Traffic routed toward subscription upgrades"
            />
            <MetricCard
              label="Projected Revenue"
              value={formatCurrency(Number(platformDashboard.revenue?.projectedRevenue ?? system.performance.estimatedRevenue))}
              detail={platformDashboard.revenue?.projectedRevenue ? "Live dashboard revenue forecast" : "Projection from current content performance"}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        {showAuthPanel ? (
          <AuthPanel
            authState={authState}
            authFeedbackState={authFeedbackState}
            authMode={authMode}
            email={email}
            password={password}
            recoveryPassword={recoveryPassword}
            recoveryPasswordConfirm={recoveryPasswordConfirm}
            authBusy={authBusy}
            authError={authError}
            authNotice={authNotice}
            signupCooldown={signupCooldown}
            resendCooldown={resendCooldown}
            onModeChange={handleModeChange}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onRecoveryPasswordChange={setRecoveryPassword}
            onRecoveryPasswordConfirmChange={setRecoveryPasswordConfirm}
            onSubmit={handleAuthSubmit}
            onForgotPassword={handleForgotPassword}
            onConfirmationRetry={handleConfirmationRetry}
            onResendConfirmation={handleResendConfirmation}
            enabled={isSupabaseEnabled}
          />
        ) : (
          <UserPanel
            session={session}
            tier={effectiveSubscription.tier}
            subscription={subscription}
            onSignOut={handleSignOut}
            historyCount={intelligence.history.length}
          />
        )}
        <AccountStatusPanel
          subscription={subscription || effectiveSubscription}
          session={session}
          authState={authState}
          onManageBilling={handleManageBilling}
          billingPortalBusy={billingPortalBusy}
          subscriptionRefreshState={checkoutSyncState}
          subscriptionRefreshAttempt={checkoutSyncAttempt}
        />
        <SubscriptionPanel pricing={pricingTiers} tier={effectiveSubscription.tier} subscription={subscription} onCheckout={handleCheckout} session={session} authState={authState} />
      </section>

      <div ref={leadCaptureRef}>
        <LeadCapturePanel
          email={leadEmail}
          status={leadBusy ? "Saving your access request..." : leadStatus}
          onEmailChange={setLeadEmail}
          onSubmit={handleLeadSubmit}
          analytics={platformDashboard.analytics}
        />
      </div>

      <SocialProofPanel analytics={platformDashboard.analytics} revenue={platformDashboard.revenue} />

      <RevenueCommandPanel
        revenue={platformDashboard.revenue}
        analytics={platformDashboard.analytics}
        briefing={platformDashboard.briefing}
        premium={platformDashboard.premium}
        onUnlock={() => setIsUpgradeModalOpen(true)}
        loading={platformBusy}
        error={platformError}
        locked={isFreeTier}
        session={session}
      />

      <section className="dashboard-grid">
        <ActivityFeedPanel
          feed={platformDashboard.activityFeed}
          loading={platformBusy}
          error={platformError}
          locked={isFreeTier}
          onUnlock={() => setIsUpgradeModalOpen(true)}
          session={session}
        />
        <AgentSuitePanel
          agents={platformDashboard.agents}
          tier={tier}
          onUnlock={() => setIsUpgradeModalOpen(true)}
          loading={platformBusy}
          error={platformError}
          locked={isFreeTier}
          session={session}
        />
      </section>

      <section className="intel-grid">
        <StockPanel agent={intelligence.market} />
        <SitrepPanel agent={intelligence.sitrep} />
        <NewsPanel agent={intelligence.news} />
      </section>
      <SectionCtaBar body="Premium intelligence delayed. Upgrade now for full real-time visibility." onUpgrade={() => setIsUpgradeModalOpen(true)} />

      <AlertFeedPanel
        alerts={visibleAlerts}
        lockedCount={Math.max(lockedHighCount, 0)}
        tier={tier}
        onClear={handleClearAlerts}
        persistence={intelligence.persistence}
        webhook={intelligence.webhook}
      />
      <SectionCtaBar body="Upgrade now to unlock the full alert stream and premium intelligence layer." onUpgrade={() => setIsUpgradeModalOpen(true)} />
      {session ? <AlertHistoryPanel history={intelligence.history} tier={tier} /> : null}

      <section className="dashboard-grid">
        <div className="panel">
          <SectionHeader
            eyebrow="Content Calendar"
            title="Publishing cadence"
            body="Traffic, engagement, and premium conversion themes rotate across the week."
          />
          <div className="calendar-grid">
            {system.calendar.map((entry) => (
              <button
                key={entry.date}
                type="button"
                className={`calendar-card ${entry.date === activeDate ? "is-active" : ""}`}
                onClick={() => setActiveDate(entry.date)}
              >
                <span>{entry.label}</span>
                <strong>{entry.focus}</strong>
                <small>{entry.goal}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <SectionHeader
            eyebrow="Monetization"
            title="Offer ladder"
            body="Use social content to funnel users into paid intelligence subscriptions and premium offer flows."
          />
          <div className="tier-grid">
            {pricingTiers.map((plan) => (
              <article className="stripe-card" key={plan.id}>
                <strong>{plan.name}</strong>
                <span>{plan.displayPrice}</span>
                <p>{plan.features.join(" · ")}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <SectionCtaBar body="Unlock full access to activate every premium dashboard surface." onUpgrade={() => setIsUpgradeModalOpen(true)} />

      <section className="panel">
        <SectionHeader
          eyebrow="Ready To Post"
          title={`${activeDate} publishing pack`}
          body="Daily AI-generated posts with copy-ready captions for TikTok, Instagram, and Facebook. Premium intelligence delayed. Upgrade for real-time signals."
        />
        {contentActionStatus ? <div className="panel-note">{contentActionStatus}</div> : null}
        <div className="channel-stack">
          {channelGroups.map((group) => (
            <section className="channel-column" key={group.channel}>
              <div className="channel-header">
                <h3>{group.channel}</h3>
                <span>{group.posts.length} posts</span>
              </div>
              {group.posts.map((post) => (
                <article className="post-card" key={post.id}>
                  <div className="post-meta">
                    <span>{post.shortId}</span>
                    <span>{post.pillar}</span>
                    <span className={post.status === "winner" ? "winner-tag" : ""}>{post.status}</span>
                  </div>
                  <h4>{post.title}</h4>
                  <p className="hook-copy">{post.hook}</p>
                  <div className="post-block">
                    <label>Caption</label>
                    <p>{post.caption}</p>
                  </div>
                  <div className="post-block">
                    <label>Hashtags</label>
                    <p>{post.hashtags}</p>
                  </div>
                  <div className="post-block">
                    <label>Video Script</label>
                    <ol>
                      {post.script.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="post-footer">
                    <span>{post.metrics.engagement} engagement</span>
                    <span>{post.metrics.clicks} clicks</span>
                    <span>${post.estimatedRevenue}</span>
                  </div>
                  <div className="post-actions">
                    <button className="ghost-button" type="button" onClick={() => handleCopyPost(post)}>
                      Copy Post
                    </button>
                    <button className="ghost-button" type="button" onClick={() => handleSharePost(post)}>
                      Share Style
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
