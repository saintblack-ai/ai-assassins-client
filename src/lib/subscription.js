export const PLAN_RANK = {
  free: 0,
  pro: 1,
  elite: 2
};

export function normalizePlan(plan) {
  const normalized = String(plan || "").trim().toLowerCase();
  if (normalized === "elite") {
    return "elite";
  }
  if (normalized === "pro") {
    return "pro";
  }
  return "free";
}

export function normalizeStatus(status, plan = "free") {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized) {
    return normalized;
  }

  return normalizePlan(plan) === "free" ? "inactive" : "active";
}

export function isActiveSubscription(status) {
  return status === "active" || status === "trialing";
}

export function hasPlanAccess(currentPlan, requiredPlan = "pro") {
  return PLAN_RANK[normalizePlan(currentPlan)] >= PLAN_RANK[normalizePlan(requiredPlan)];
}

export const TIER_EXPERIENCES = {
  free: {
    id: "free",
    name: "Free Preview",
    audience: "Visitor or free account",
    headline: "Preview intelligence and upgrade when ready.",
    briefing: "Delayed teaser briefing",
    alerts: "Delayed high-threat previews",
    dashboard: "Read-only preview shell",
    operator: "Operator overview locked",
    analytics: "Limited public metrics",
    checkoutCta: "Upgrade to Pro"
  },
  pro: {
    id: "pro",
    name: "Pro Command",
    audience: "Paid intelligence member",
    headline: "Full daily briefing and premium dashboard access.",
    briefing: "Full daily intelligence briefing",
    alerts: "Live premium alert feed",
    dashboard: "Full dashboard actions",
    operator: "Member tools unlocked",
    analytics: "Saved history and premium categories",
    checkoutCta: "Upgrade to Elite"
  },
  elite: {
    id: "elite",
    name: "Elite Priority",
    audience: "Priority intelligence operator",
    headline: "Priority signals, elite reports, and deeper analysis.",
    briefing: "Priority intelligence feed",
    alerts: "Highest-urgency signals",
    dashboard: "Full dashboard and elite panels",
    operator: "Full operator visibility",
    analytics: "Full analytics visibility",
    checkoutCta: "Manage Elite"
  }
};

export function getTierExperience(plan) {
  return TIER_EXPERIENCES[normalizePlan(plan)] || TIER_EXPERIENCES.free;
}

export function getRequiredPlanLabel(requiredPlan = "pro") {
  return getTierExperience(requiredPlan).name;
}

export function normalizeSubscriptionRecord(subscription) {
  const plan = normalizePlan(subscription?.plan || subscription?.tier);
  const status = normalizeStatus(subscription?.status, plan);

  return {
    id: subscription?.id || null,
    userId: subscription?.user_id || subscription?.userId || null,
    plan,
    tier: plan,
    status,
    active: isActiveSubscription(status),
    createdAt: subscription?.created_at || subscription?.createdAt || null,
    currentPeriodEnd: subscription?.current_period_end || subscription?.currentPeriodEnd || null,
    stripeCustomerId: subscription?.stripe_customer_id || subscription?.stripeCustomerId || null,
    stripeSubscriptionId: subscription?.stripe_subscription_id || subscription?.stripeSubscriptionId || null
  };
}

export function getContentAccessState(subscription) {
  const normalized = normalizeSubscriptionRecord(subscription);
  const paidAccess = normalized.active && hasPlanAccess(normalized.plan, "pro");
  const eliteAccess = normalized.active && hasPlanAccess(normalized.plan, "elite");

  return {
    ...normalized,
    experience: getTierExperience(normalized.plan),
    locked: !normalized.active,
    unlocked: normalized.active,
    canViewPreview: true,
    canViewFullBriefing: paidAccess,
    canUseAiTools: paidAccess,
    canAccessMusic: paidAccess,
    canAccessBooks: paidAccess,
    canManageBilling: normalized.active && normalized.plan !== "free",
    canAccessEliteSignals: eliteAccess,
    canViewEliteReports: eliteAccess
  };
}

export const FEATURE_GATES = [
  {
    key: "dailyBriefing",
    label: "Full Daily Briefing",
    free: "Delayed teaser",
    pro: "Unlocked",
    elite: "Priority unlocked",
    requiredPlan: "pro"
  },
  {
    key: "premiumCategories",
    label: "Premium Categories",
    free: "Locked",
    pro: "Unlocked",
    elite: "Unlocked",
    requiredPlan: "pro"
  },
  {
    key: "savedHistory",
    label: "Saved History",
    free: "Limited",
    pro: "Unlocked",
    elite: "Unlocked",
    requiredPlan: "pro"
  },
  {
    key: "prioritySignals",
    label: "Priority Signals",
    free: "Locked",
    pro: "Standard",
    elite: "Priority",
    requiredPlan: "elite"
  },
  {
    key: "eliteReports",
    label: "Elite Reports",
    free: "Locked",
    pro: "Locked",
    elite: "Unlocked",
    requiredPlan: "elite"
  }
];

export function getPlanFeatureLabel(gate, plan) {
  const normalized = normalizePlan(plan);
  return gate[normalized] || gate.free;
}

export function getFeatureGateState(gate, subscription) {
  const access = getContentAccessState(subscription);
  const requiredPlan = normalizePlan(gate?.requiredPlan || "pro");
  const allowed = access.active && hasPlanAccess(access.plan, requiredPlan);

  return {
    key: gate?.key || "",
    label: gate?.label || "Protected feature",
    allowed,
    currentPlan: access.plan,
    currentStatus: access.status,
    requiredPlan,
    requiredPlanLabel: getRequiredPlanLabel(requiredPlan),
    currentLabel: getPlanFeatureLabel(gate || {}, access.plan),
    reason: allowed
      ? "Unlocked for current tier."
      : access.active
        ? `Requires ${getRequiredPlanLabel(requiredPlan)}.`
        : "Requires an active paid subscription."
  };
}
