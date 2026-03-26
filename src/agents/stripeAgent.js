import { createCheckoutSession } from "../lib/platform";

export const STRIPE_PLANS = [
  {
    id: "free",
    label: "Free",
    price: "$0",
    headline: "Limited intelligence mode",
    description: "Delayed high-threat alerts, locked actions, and a preview-only control layer."
  },
  {
    id: "pro",
    label: "Pro",
    price: "$49",
    headline: "Unlock full intelligence",
    description: "Full alerts, post generation, intelligence refresh, and complete operational visibility."
  },
  {
    id: "elite",
    label: "Elite",
    price: "$99",
    headline: "Priority signals",
    description: "Everything in Pro plus priority escalation and first-line high-threat delivery."
  }
];

export async function startStripeCheckout(accessToken, tier) {
  if (!accessToken) {
    throw new Error("Sign in to start Stripe checkout");
  }

  if (tier !== "pro" && tier !== "elite") {
    throw new Error("Only Pro and Elite support checkout");
  }

  return createCheckoutSession(accessToken, tier);
}
