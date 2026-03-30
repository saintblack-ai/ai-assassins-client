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
    price: 49,
    displayPrice: "$49/month",
    features: ["Full AI dashboard", "Live alerts", "Content generation", "Full system access"]
  },
  {
    id: "elite",
    name: "Elite",
    price: 99,
    displayPrice: "$99/month",
    features: ["Priority signals", "High-threat alerts", "Premium intelligence layer"]
  }
];

export const PRICING_TIER_MAP = Object.fromEntries(
  PRICING_TIERS.map((tier) => [tier.id, tier])
);

export const PAID_TIER_IDS = PRICING_TIERS.filter((tier) => tier.price > 0).map((tier) => tier.id);

export function getPricingTier(tierId) {
  return PRICING_TIER_MAP[tierId] || PRICING_TIER_MAP.free;
}
