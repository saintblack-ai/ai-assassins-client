import { PAID_TIER_IDS, PRICING_TIERS } from "../lib/pricing";
import { createCheckoutSession } from "../lib/platform";

export const STRIPE_PLANS = PRICING_TIERS;

export async function startStripeCheckout(accessToken, tier) {
  if (!accessToken) {
    throw new Error("Sign in to start Stripe checkout");
  }

  if (!PAID_TIER_IDS.includes(tier)) {
    throw new Error("Only Pro and Elite support checkout");
  }

  // TODO(stripe): This stays as a thin client wrapper until live Stripe keys are enabled.
  return createCheckoutSession(accessToken, tier);
}
