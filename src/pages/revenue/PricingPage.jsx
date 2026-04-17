import { useEffect, useState } from "react";
import { startStripeCheckout } from "../../agents/stripeAgent";
import CommandNav from "../../components/CommandNav";
import { getCurrentSession, logCtaClick, trackRevenueEvent } from "../../lib/platform";
import { PAID_TIER_IDS, PRICING_TIERS } from "../../lib/pricing";
import { FEATURE_GATES, getTierExperience } from "../../lib/subscription";

function getPlanPosition(planId) {
  if (planId === "free") return "Funnel entry";
  if (planId === "pro") return "Core revenue plan";
  return "Priority intelligence plan";
}

export default function PricingPage() {
  const [session, setSession] = useState(null);
  const [busyTier, setBusyTier] = useState("");
  const [message, setMessage] = useState(() => {
    if (typeof window === "undefined") {
      return "Stripe checkout uses the existing authenticated Worker flow. Missing credentials show a safe backend error.";
    }

    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (checkout === "success") {
      return "Stripe returned successfully. Open the dashboard to verify subscription sync.";
    }
    if (checkout === "cancel") {
      return "Checkout was canceled. No billing changes were made.";
    }

    return "Stripe checkout uses the existing authenticated Worker flow. Missing credentials show a safe backend error.";
  });

  useEffect(() => {
    getCurrentSession().then(setSession).catch(() => setSession(null));
  }, []);

  async function handleCheckout(tier) {
    await logCtaClick("pricing_cta", `pricing:${tier}`, tier).catch(() => null);

    if (!PAID_TIER_IDS.includes(tier)) {
      window.location.href = `${import.meta.env.BASE_URL || "/"}#auth`;
      return;
    }

    if (!session?.access_token) {
      setMessage("Sign in first, then return to pricing to start secure checkout.");
      await trackRevenueEvent("checkout_blocked_auth", { location: "pricing", requestedTier: tier, authState: "signed-out" });
      return;
    }

    setBusyTier(tier);
    setMessage(`Starting ${tier.toUpperCase()} checkout...`);

    try {
      await trackRevenueEvent("checkout_start", { location: "pricing", requestedTier: tier, authState: "signed-in" });
      const payload = await startStripeCheckout(session.access_token, tier);
      const url = payload?.url || payload?.checkoutUrl;
      if (!url) {
        throw new Error("Stripe checkout URL missing.");
      }
      window.location.href = url;
    } catch (error) {
      setMessage(String(error?.message || "Checkout is not configured yet. Verify Stripe env vars and Worker deployment."));
      setBusyTier("");
    }
  }

  return (
    <main className="revenue-shell">
      <CommandNav current="pricing" />
      <section className="revenue-hero pricing-hero">
        <div>
          <span className="revenue-eyebrow">AI Assassins Pricing</span>
          <h1>Choose your intelligence tier.</h1>
          <p>
            Pro and Elite use Stripe Checkout Sessions in subscription mode. The frontend never stores secret keys.
            Live activation requires Worker secrets and Stripe test-mode verification first.
          </p>
          <div className="revenue-actions">
            <a href={`${import.meta.env.BASE_URL || "/"}landing`}>Back to Landing</a>
            <a className="secondary" href={`${import.meta.env.BASE_URL || "/"}dashboard`}>Dashboard</a>
            <a className="secondary" href={`${import.meta.env.BASE_URL || "/"}dashboard?mock=1`}>Preview Mock Dashboard</a>
          </div>
          <p className="revenue-status">{message}</p>
        </div>
      </section>

      <section className="revenue-pricing-grid pricing-page-grid">
        {PRICING_TIERS.map((plan) => (
          <article className={`revenue-card revenue-plan-card ${plan.id === "pro" ? "featured" : ""}`} key={plan.id}>
            <span className="revenue-eyebrow">{getPlanPosition(plan.id)}</span>
            <h2>{plan.name}</h2>
            <strong>{plan.displayPrice}</strong>
            <p>{plan.summary}</p>
            <p className="revenue-status">{getTierExperience(plan.id).headline}</p>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
              <li>{getTierExperience(plan.id).briefing}</li>
              <li>{getTierExperience(plan.id).alerts}</li>
            </ul>
            <button type="button" onClick={() => handleCheckout(plan.id)} disabled={busyTier === plan.id}>
              {plan.id === "free" ? "Start Free" : busyTier === plan.id ? "Starting..." : `Start ${plan.name}`}
            </button>
          </article>
        ))}
      </section>

      <section className="revenue-section">
        <div className="revenue-section-head">
          <span className="revenue-eyebrow">Feature Gate</span>
          <h2>Free previews convert into paid intelligence.</h2>
        </div>
        <div className="feature-gate-table">
          <div className="feature-gate-row feature-gate-head">
            <span>Feature</span>
            <span>Free</span>
            <span>Pro</span>
            <span>Elite</span>
          </div>
          {FEATURE_GATES.map((gate) => (
            <div className="feature-gate-row" key={gate.key}>
              <strong>{gate.label}</strong>
              <span>{gate.free}</span>
              <span>{gate.pro}</span>
              <span>{gate.elite}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
