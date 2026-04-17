import test from "node:test";
import assert from "node:assert/strict";
import {
  getFeatureGateState,
  getContentAccessState,
  getTierExperience,
  hasPlanAccess,
  normalizeSubscriptionRecord
} from "./subscription.js";

test("normalizeSubscriptionRecord falls back to free inactive state", () => {
  assert.deepEqual(normalizeSubscriptionRecord(null), {
    id: null,
    userId: null,
    plan: "free",
    tier: "free",
    status: "inactive",
    active: false,
    createdAt: null,
    currentPeriodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null
  });
});

test("paid active plans unlock protected content", () => {
  const access = getContentAccessState({
    tier: "pro",
    status: "active"
  });

  assert.equal(access.unlocked, true);
  assert.equal(access.canUseAiTools, true);
  assert.equal(access.canViewFullBriefing, true);
  assert.equal(access.canAccessMusic, true);
  assert.equal(access.canAccessBooks, true);
  assert.equal(access.canAccessEliteSignals, false);
  assert.equal(access.experience.name, "Pro Command");
});

test("inactive subscriptions remain locked", () => {
  const access = getContentAccessState({
    tier: "elite",
    status: "inactive"
  });

  assert.equal(access.unlocked, false);
  assert.equal(access.canUseAiTools, false);
  assert.equal(access.canAccessEliteSignals, false);
  assert.equal(access.canViewEliteReports, false);
});

test("plan hierarchy respects elite over pro", () => {
  assert.equal(hasPlanAccess("elite", "pro"), true);
  assert.equal(hasPlanAccess("pro", "elite"), false);
});

test("tier experience normalizes unknown plans to free preview", () => {
  assert.equal(getTierExperience("unknown").id, "free");
  assert.equal(getTierExperience("elite").operator, "Full operator visibility");
});

test("feature gate state explains locked and unlocked tiers", () => {
  const gate = {
    key: "eliteReports",
    label: "Elite Reports",
    free: "Locked",
    pro: "Locked",
    elite: "Unlocked",
    requiredPlan: "elite"
  };

  const proState = getFeatureGateState(gate, { plan: "pro", status: "active" });
  const eliteState = getFeatureGateState(gate, { plan: "elite", status: "active" });

  assert.equal(proState.allowed, false);
  assert.equal(proState.reason, "Requires Elite Priority.");
  assert.equal(eliteState.allowed, true);
  assert.equal(eliteState.currentLabel, "Unlocked");
});
