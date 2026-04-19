export const PRICING_TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    displayPrice: "$0",
    features: ["Limited intelligence mode", "Delayed alerts", "Preview dashboard"]
  },
  {
    id: "pro",
    name: "Pro",
    price: 49.99,
    displayPrice: "$49.99/month",
    stripeCheckoutUrl: "https://buy.stripe.com/cNi00c09ydYl0EjbHJbII02",
    features: [
      "Full AI dashboard",
      "Live alerts",
      "Content generation",
      "Full system access"
    ]
  },
  {
    id: "elite",
    name: "Elite",
    price: 99.99,
    displayPrice: "$99.99/month",
    stripeCheckoutUrl: "https://buy.stripe.com/eVq00c5tS9I55YD135bII05",
    features: [
      "Priority signals",
      "High-threat alerts",
      "Premium intelligence layer"
    ]
  }
];

export const ONE_OFF_PAYMENT_LINKS = {
  5: "https://buy.stripe.com/aFabIU09y2fD4Uz5jlbII06",
  7: "https://buy.stripe.com/cNifZaf4sbQd0Ejh23bII04"
};

export const PRICING_TIER_MAP = Object.fromEntries(
  PRICING_TIERS.map((tier) => [tier.id, tier])
);

export const PAID_TIER_IDS = PRICING_TIERS.filter((tier) => tier.price > 0).map(
  (tier) => tier.id
);

export function getPricingTier(tierId) {
  return PRICING_TIER_MAP[tierId] || PRICING_TIER_MAP.free;
}
