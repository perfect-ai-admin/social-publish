"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { listPlans, getSubscription, getUsage } from "@/services/billing";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";

export default function BillingPage() {
  const workspaceId = getCurrentWorkspaceId();

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: listPlans,
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription", workspaceId],
    queryFn: () => getSubscription(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: usage = {} } = useQuery({
    queryKey: ["usage", workspaceId],
    queryFn: () => getUsage(workspaceId!),
    enabled: !!workspaceId,
  });

  const currentPlan = subscription?.plan_name || "starter";
  const currentPlanData = plans.find((p) => p.name === currentPlan);
  const limits = currentPlanData?.limits || { posts_per_month: 30, connections: 3, ai_credits: 50, storage_mb: 500 };

  const usageItems = [
    { label: "Posts", used: usage.post_published || 0, limit: limits.posts_per_month === -1 ? "∞" : limits.posts_per_month },
    { label: "Channels", used: usage.channel_connected || 0, limit: limits.connections === -1 ? "∞" : limits.connections },
    { label: "AI Credits", used: usage.ai_caption_generated || 0, limit: limits.ai_credits === -1 ? "∞" : limits.ai_credits },
    { label: "Storage", used: `${Math.round((usage.storage_used || 0) / 1024 / 1024)} MB`, limit: limits.storage_mb === -1 ? "∞" : `${limits.storage_mb} MB` },
  ];

  if (plansLoading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      {/* Current subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Current Plan
            <Badge variant="default">{currentPlan}</Badge>
            {subscription?.status && <Badge variant="outline">{subscription.status}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {usageItems.map((u) => {
              const numUsed = typeof u.used === "number" ? u.used : 0;
              const numLimit = typeof u.limit === "number" ? u.limit : 100;
              const pct = typeof u.limit === "number" ? Math.min((numUsed / numLimit) * 100, 100) : 0;
              return (
                <div key={u.label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{u.label}</p>
                  <p className="text-sm font-medium">{u.used} / {u.limit}</p>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.name === currentPlan;
          const isPopular = plan.name === "pro";
          return (
            <Card key={plan.id} className={`relative ${isPopular ? "border-primary shadow-md" : ""}`}>
              {isPopular && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Most Popular</Badge>}
              <CardHeader>
                <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                <div>
                  <span className="text-3xl font-bold">${plan.price_monthly}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.connections === -1 ? "Unlimited" : plan.limits.connections} channels</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.brands === -1 ? "Unlimited" : plan.limits.brands} brands</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.posts_per_month === -1 ? "Unlimited" : plan.limits.posts_per_month} posts/mo</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.ai_credits === -1 ? "Unlimited" : plan.limits.ai_credits} AI credits</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.members === -1 ? "Unlimited" : plan.limits.members} team members</li>
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || plan.name === "enterprise"}
                  onClick={async () => {
                    if (!plan.stripe_price_id_monthly) {
                      toast.error("Stripe price not configured for this plan");
                      return;
                    }
                    try {
                      const res = await fetch("/api/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          workspace_id: workspaceId,
                          plan_name: plan.name,
                          price_id: plan.stripe_price_id_monthly,
                        }),
                      });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                      else toast.error(data.error || "Checkout failed");
                    } catch { toast.error("Checkout failed"); }
                  }}
                >
                  {isCurrent ? "Current Plan" : plan.name === "enterprise" ? "Contact Sales" : `Upgrade to ${plan.display_name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
