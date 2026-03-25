import { useEffect, useMemo, useRef, useState } from "react";
import { runIntelligenceAgents } from "./agents/alertCenter";
import { isSupabaseEnabled } from "./lib/supabase";
import {
  clearUserAlerts,
  createCheckoutSession,
  fetchSubscription,
  fetchUserAlerts,
  getCurrentSession,
  getUserTier,
  hasPaidAccess,
  signIn,
  signOut,
  signUp,
  subscribeToAuthChanges
} from "./lib/platform";
import "./app.css";

const BRAND = "Saint Black";
const THEME = "ARCHAIOS";
const CHANNELS = ["TikTok", "Instagram", "Facebook"];
const STORAGE_KEY = "saint-black-marketing-system-v5";
const REFRESH_INTERVAL_MS = 60000;

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

const STRIPE_LINKS = [
  {
    id: "free",
    label: "Free",
    price: "$0",
    description: "Limited alerts, medium and normal visibility, community access."
  },
  {
    id: "pro",
    label: "Pro",
    price: "$49/mo",
    description: "Full alerts, full /api/alerts access, complete history visibility."
  },
  {
    id: "elite",
    label: "Elite",
    price: "$99/mo",
    description: "Priority signals, high-threat escalation, first-line intelligence."
  }
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

function levelLabel(level) {
  if (level === "high") {
    return "High threat";
  }
  if (level === "medium") {
    return "Medium threat";
  }
  return "Normal";
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

function AuthPanel({
  authMode,
  email,
  password,
  authBusy,
  authError,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  enabled
}) {
  return (
    <section className="panel">
      <SectionHeader
        eyebrow="User Auth"
        title="Supabase access"
        body={enabled ? "Sign in to persist alerts, unlock subscriptions, and personalize intelligence." : "Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable auth."}
      />
      <div className="auth-toggle">
        <button className={authMode === "signin" ? "primary-button" : "ghost-button"} type="button" onClick={() => onModeChange("signin")}>
          Sign In
        </button>
        <button className={authMode === "signup" ? "primary-button" : "ghost-button"} type="button" onClick={() => onModeChange("signup")}>
          Create Account
        </button>
      </div>
      <form className="auth-form" onSubmit={onSubmit}>
        <input className="auth-input" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="Email" required disabled={!enabled || authBusy} />
        <input className="auth-input" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Password" required disabled={!enabled || authBusy} />
        {authError ? <p className="auth-error">{authError}</p> : null}
        <button className="primary-button" type="submit" disabled={!enabled || authBusy}>
          {authBusy ? "Working..." : authMode === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </section>
  );
}

function SubscriptionPanel({ tier, onCheckout, session }) {
  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Subscription Tiers"
        title="Monetized intelligence access"
        body="Free users get limited alerts. Pro unlocks full access. Elite gets priority signals and first-line escalation."
      />
      <div className="tier-grid">
        {STRIPE_LINKS.map((plan) => (
          <article className={`tier-card ${tier === plan.id ? "tier-card-active" : ""}`} key={plan.id}>
            <p className="eyebrow">{plan.label}</p>
            <h3>{plan.price}</h3>
            <p>{plan.description}</p>
            {plan.id === "free" ? (
              <div className="status-chip">Current baseline access</div>
            ) : (
              <button className="ghost-button" type="button" onClick={() => onCheckout(plan.id)} disabled={!session}>
                {session ? `Upgrade to ${plan.label}` : "Sign in to upgrade"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function UserPanel({ session, tier, subscription, onSignOut, historyCount }) {
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
          <span>Tier: {tier}</span>
          <span>{hasPaidAccess(tier) ? "Paid access enabled" : "Free access limits active"}</span>
        </article>
        <article className="memory-card">
          <strong>/api/alerts</strong>
          <span>{hasPaidAccess(tier) ? "Full alert payloads" : "High alerts restricted"}</span>
          <span>{tier === "elite" ? "Priority signals enabled" : "Priority signals locked"}</span>
        </article>
        <article className="memory-card">
          <strong>History</strong>
          <span>{historyCount} alerts loaded</span>
          <span>{subscription?.paid ? "Billing active" : "Upgrade to unlock more"}</span>
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
        body="Paid users can see high-level alerts. Free tier sees medium and normal visibility only."
        action="CLEAR ALERTS"
        onAction={onClear}
      />
      <div className="status-row status-row-wrap">
        <div className="status-chip">Tier: {tier}</div>
        <div className="status-chip">Supabase: {persistence.enabled ? `saved ${persistence.saved}` : "disabled"}</div>
        <div className="status-chip">Webhook: {webhook.enabled ? `sent ${webhook.sent}` : "disabled"}</div>
        {!hasPaidAccess(tier) && lockedCount > 0 ? (
          <div className="status-chip">{lockedCount} high alerts locked behind Pro</div>
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
  const [session, setSession] = useState(null);
  const [tier, setTier] = useState("free");
  const [subscription, setSubscription] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [activeDate, setActiveDate] = useState(() => loadSystemState().calendar[0].date);
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(system));
  }, [system]);

  useEffect(() => {
    getCurrentSession().then(setSession);
    const authListener = subscribeToAuthChanges((nextSession) => setSession(nextSession));
    return () => authListener.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadSubscriptionState() {
      if (!session?.user?.id) {
        setTier("free");
        setSubscription(null);
        setIntelligence((current) => ({ ...current, history: [] }));
        return;
      }

      const accessToken = session.access_token;
      const [serverSubscription, fallbackTier] = await Promise.all([
        fetchSubscription(accessToken).catch(() => null),
        getUserTier(session.user.id).catch(() => "free")
      ]);

      const resolvedTier = serverSubscription?.tier || fallbackTier || "free";
      setTier(resolvedTier);
      setSubscription(serverSubscription || { tier: resolvedTier, paid: hasPaidAccess(resolvedTier) });
    }

    loadSubscriptionState();
  }, [session]);

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

  const fetchAllData = async () => {
    setIntelligence((current) => ({
      ...current,
      isRefreshing: true,
      market: current.generatedAt ? current.market : { ...current.market, status: "loading", error: null },
      news: current.generatedAt ? current.news : { ...current.news, status: "loading", error: null },
      sitrep: current.generatedAt ? current.sitrep : { ...current.sitrep, status: "loading", error: null }
    }));

    const accessToken = session?.access_token || null;
    const userId = session?.user?.id || null;

    const [agentResult, alertPayload] = await Promise.all([
      runIntelligenceAgents({ userId, tier }),
      accessToken ? fetchUserAlerts(accessToken).catch(() => null) : Promise.resolve(null)
    ]);

    setIntelligence({
      ...agentResult,
      history: alertPayload?.alerts || [],
      isRefreshing: false
    });
  };

  useEffect(() => {
    fetchAllData();
    const intervalId = window.setInterval(fetchAllData, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [session?.user?.id, tier]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");

    try {
      if (authMode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      setEmail("");
      setPassword("");
    } catch (error) {
      setAuthError(String(error?.message || error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCheckout = async (requestedTier) => {
    if (!session?.access_token) {
      return;
    }

    const payload = await createCheckoutSession(session.access_token, requestedTier);
    if (payload?.url) {
      window.location.href = payload.url;
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
    await signOut();
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
            <button className="primary-button" onClick={runAutomation} type="button">
              Generate Today&apos;s 9 Posts
            </button>
            <button className="ghost-button" onClick={fetchAllData} type="button">
              Refresh Intelligence Now
            </button>
            <button className="ghost-button" onClick={createNextWeek} type="button">
              Extend Content Calendar
            </button>
          </div>
        </div>

        <div className="hero-status">
          <div className="status-row">
            <StatusIndicator status={currentStatus} label={currentStatus === "live" ? "Live" : "Offline"} />
            <AlertBadge level={intelligence.systemLevel} />
            <div className="status-chip">Tier: {tier}</div>
            <div className="status-chip">Last sync: {formatTime(intelligence.generatedAt)}</div>
            {intelligence.isRefreshing ? <div className="status-chip">Refreshing live feeds...</div> : null}
          </div>
          <div className="status-chip">Auth: {session?.user?.email || "Guest mode"}</div>
          <div className="status-chip">Paid access: {hasPaidAccess(tier) ? "Unlocked" : "Limited"}</div>
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
              label="Estimated Revenue"
              value={`$${system.performance.estimatedRevenue.toLocaleString()}`}
              detail="Projected from premium conversion flows"
            />
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        {!session ? (
          <AuthPanel
            authMode={authMode}
            email={email}
            password={password}
            authBusy={authBusy}
            authError={authError}
            onModeChange={setAuthMode}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleAuthSubmit}
            enabled={isSupabaseEnabled}
          />
        ) : (
          <UserPanel
            session={session}
            tier={tier}
            subscription={subscription}
            onSignOut={handleSignOut}
            historyCount={intelligence.history.length}
          />
        )}
        <SubscriptionPanel tier={tier} onCheckout={handleCheckout} session={session} />
      </section>

      <section className="intel-grid">
        <StockPanel agent={intelligence.market} />
        <SitrepPanel agent={intelligence.sitrep} />
        <NewsPanel agent={intelligence.news} />
      </section>

      <AlertFeedPanel
        alerts={visibleAlerts}
        lockedCount={Math.max(lockedHighCount, 0)}
        tier={tier}
        onClear={handleClearAlerts}
        persistence={intelligence.persistence}
        webhook={intelligence.webhook}
      />
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
            {STRIPE_LINKS.map((plan) => (
              <article className="stripe-card" key={plan.id}>
                <strong>{plan.label}</strong>
                <span>{plan.price}</span>
                <p>{plan.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <SectionHeader
          eyebrow="Ready To Post"
          title={`${activeDate} publishing pack`}
          body="Three posts per channel with hooks, captions, and scripts designed to drive subscription upgrades."
        />
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
                </article>
              ))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
