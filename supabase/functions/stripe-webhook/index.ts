import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function normalizeTier(value: unknown) {
  return String(value || "").toLowerCase() === "elite" ? "elite" : "pro";
}

function stripeTime(value: unknown) {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

async function findSubscriptionRecord(stripeSubscriptionId: string | null, userId: string | null) {
  if (stripeSubscriptionId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  if (userId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  return null;
}

async function persistSubscription(record: Record<string, unknown>) {
  const existing = await findSubscriptionRecord(
    String(record.stripe_subscription_id || "") || null,
    String(record.user_id || "") || null
  );

  if (existing?.id) {
    const { error } = await supabase
      .from("subscriptions")
      .update(record)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("subscriptions").insert(record);
  if (error) throw error;
}

async function syncSubscriptionObject(subscription: Stripe.Subscription, event: Stripe.Event) {
  const metadata = subscription.metadata || {};
  const existing = await findSubscriptionRecord(
    subscription.id,
    String(metadata.user_id || metadata.userId || "") || null
  );
  const userId = String(metadata.user_id || metadata.userId || existing?.user_id || "");
  if (!userId) {
    throw new Error("Subscription event has no user mapping.");
  }

  const price = subscription.items?.data?.[0]?.price;
  const customer =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  await persistSubscription({
    user_id: userId,
    plan: normalizeTier(metadata.tier || metadata.plan || existing?.plan),
    status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
    current_period_end: stripeTime(subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    stripe_customer_id: customer || existing?.stripe_customer_id || null,
    stripe_subscription_id: subscription.id,
    stripe_price_id: price?.id || existing?.stripe_price_id || null,
    monthly_amount:
      typeof price?.unit_amount === "number"
        ? price.unit_amount / 100
        : Number(existing?.monthly_amount || 0),
    billing_state:
      event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
    last_stripe_event_id: event.id,
    updated_at: new Date().toISOString(),
  });
}

async function syncCheckoutSession(session: Stripe.Checkout.Session, event: Stripe.Event) {
  const metadata = session.metadata || {};
  const userId = String(metadata.user_id || session.client_reference_id || "");
  if (!userId) {
    throw new Error("Checkout session has no user mapping.");
  }

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || null;

  await persistSubscription({
    user_id: userId,
    plan: normalizeTier(metadata.tier),
    status:
      session.payment_status === "paid" || session.status === "complete"
        ? "active"
        : "incomplete",
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    billing_state: session.payment_status || session.status || "checkout_complete",
    last_stripe_event_id: event.id,
    updated_at: new Date().toISOString(),
  });
}

async function currentRecurringMetrics() {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status,monthly_amount");

  if (error) throw error;

  const active = (data || []).filter((row) => ACTIVE_STATUSES.has(String(row.status || "")));
  return {
    activeSubscriptions: active.length,
    mrr: active.reduce((sum, row) => sum + Number(row.monthly_amount || 0), 0),
  };
}

async function getRevenueSummary() {
  const { data, error } = await supabase
    .from("revenue_summary")
    .select("*")
    .eq("scope", "global")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function writeRevenueSummary(values: Record<string, unknown>) {
  const { error } = await supabase.from("revenue_summary").upsert(
    {
      scope: "global",
      ...values,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "scope" }
  );

  if (error) throw error;
}

async function hasRecordedRevenueEvent(eventId: string) {
  const { data, error } = await supabase
    .from("revenue_events")
    .select("id")
    .eq("stripe_event_id", eventId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function recordInvoiceEvent(event: Stripe.Event) {
  if (await hasRecordedRevenueEvent(event.id)) {
    return;
  }

  const invoice = event.data.object as Stripe.Invoice;
  const succeeded = event.type === "invoice.payment_succeeded";
  const amount = succeeded ? (invoice.amount_paid ?? 0) / 100 : null;
  const occurredAt = new Date(event.created * 1000).toISOString();

  const { error } = await supabase.from("revenue_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    event_type: event.type,
    amount,
    revenue_delta: succeeded ? amount : null,
    status: succeeded ? "succeeded" : "failed",
    occurred_at: occurredAt,
    customer_email: invoice.customer_email ?? null,
  });

  if (error) throw error;

  const summary = await getRevenueSummary();
  const recurring = await currentRecurringMetrics();

  await writeRevenueSummary({
    total_revenue:
      Number(summary?.total_revenue || 0) + (succeeded ? Number(amount || 0) : 0),
    mrr: recurring.mrr,
    active_subscriptions: recurring.activeSubscriptions,
    failed_payments:
      Number(summary?.failed_payments || 0) + (succeeded ? 0 : 1),
    last_payment_at: succeeded ? occurredAt : summary?.last_payment_at ?? null,
    revenue_status: recurring.activeSubscriptions > 0 ? "Active" : "Initialized",
    source_event_id: event.id,
  });
}

async function refreshRecurringSummary(eventId: string) {
  const summary = await getRevenueSummary();
  const recurring = await currentRecurringMetrics();

  await writeRevenueSummary({
    total_revenue: Number(summary?.total_revenue || 0),
    mrr: recurring.mrr,
    active_subscriptions: recurring.activeSubscriptions,
    failed_payments: Number(summary?.failed_payments || 0),
    last_payment_at: summary?.last_payment_at ?? null,
    revenue_status: recurring.activeSubscriptions > 0 ? "Active" : "Initialized",
    source_event_id: eventId,
  });
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return new Response(`Invalid signature: ${String(error)}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await syncCheckoutSession(event.data.object as Stripe.Checkout.Session, event);
      await refreshRecurringSummary(event.id);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscriptionObject(event.data.object as Stripe.Subscription, event);
      await refreshRecurringSummary(event.id);
    } else if (
      event.type === "invoice.payment_succeeded" ||
      event.type === "invoice.payment_failed"
    ) {
      await recordInvoiceEvent(event);
    } else {
      return new Response("Ignored event", { status: 200 });
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("stripe-webhook repair handler failed", {
      eventId: event.id,
      type: event.type,
      message: String(error),
    });
    return new Response("Webhook processing failed", { status: 500 });
  }
});
