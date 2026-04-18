import { createClient } from "@/lib/supabase/client";

function getClient() { return createClient(); }

export interface BillingPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number | null;
  currency: string;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  features: Record<string, unknown>;
  limits: {
    posts_per_month: number;
    connections: number;
    brands: number;
    products: number;
    ai_credits: number;
    members: number;
    storage_mb: number;
  };
  is_active: boolean;
  sort_order: number;
}

export interface WorkspaceSubscription {
  id: string;
  workspace_id: string;
  plan_name: string;
  stripe_subscription_id: string | null;
  status: "trialing" | "active" | "past_due" | "cancelled" | "paused";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export async function listPlans() {
  const { data, error } = await getClient()
    .from("billing_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as BillingPlan[];
}

export async function getSubscription(workspaceId: string) {
  const { data, error } = await getClient()
    .from("workspace_subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as WorkspaceSubscription | null;
}

export async function getUsage(workspaceId: string) {
  const now = new Date();
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await getClient()
    .from("usage_events")
    .select("event_type, quantity")
    .eq("workspace_id", workspaceId)
    .eq("period_month", periodMonth);
  if (error) throw error;

  const usage: Record<string, number> = {};
  for (const e of data ?? []) {
    usage[e.event_type] = (usage[e.event_type] ?? 0) + e.quantity;
  }
  return usage;
}

export async function trackUsage(workspaceId: string, eventType: string, quantity = 1) {
  const now = new Date();
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { error } = await getClient().from("usage_events").insert({
    workspace_id: workspaceId,
    event_type: eventType,
    quantity,
    period_month: periodMonth,
  });
  if (error) throw error;
}
