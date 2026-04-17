import {
  getRequiredPlanLabel,
  getTierExperience,
  hasPlanAccess,
  isActiveSubscription,
  normalizePlan
} from "../lib/subscription";

export default function ProtectedContent({
  requiredPlan = "pro",
  currentPlan = "free",
  status = "inactive",
  title = "Protected content",
  description = "Upgrade to unlock this content.",
  fallback,
  children
}) {
  const active = isActiveSubscription(status);
  const allowed = active && hasPlanAccess(currentPlan, requiredPlan);
  const currentExperience = getTierExperience(currentPlan);
  const requiredExperience = getTierExperience(requiredPlan);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return fallback;
  }

  return (
    <article className="saint-dashboard-card saint-dashboard-card-locked">
      <div className="saint-card-head">
        <p className="eyebrow">Locked</p>
        <span className="status-chip">Requires {normalizePlan(requiredPlan).toUpperCase()}</span>
      </div>
      <h3>{title}</h3>
      <p>
        {active
          ? description
          : `${currentExperience.name} is limited to preview mode. ${getRequiredPlanLabel(requiredPlan)} unlocks ${requiredExperience.dashboard.toLowerCase()}.`}
      </p>
    </article>
  );
}
