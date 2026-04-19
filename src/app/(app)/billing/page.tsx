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
    { label: "פוסטים", used: usage.post_published || 0, limit: limits.posts_per_month === -1 ? "∞" : limits.posts_per_month },
    { label: "ערוצים", used: usage.channel_connected || 0, limit: limits.connections === -1 ? "∞" : limits.connections },
    { label: "קרדיטים AI", used: usage.ai_caption_generated || 0, limit: limits.ai_credits === -1 ? "∞" : limits.ai_credits },
    { label: "אחסון", used: `${Math.round((usage.storage_used || 0) / 1024 / 1024)} MB`, limit: limits.storage_mb === -1 ? "∞" : `${limits.storage_mb} MB` },
  ];

  if (plansLoading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">חיוב ותשלום</h1>

      {/* Current subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            תוכנית נוכחית
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
                  <p className="text-sm font-medium tabular-nums">{u.used} / {u.limit}</p>
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
            <Card key={plan.id} className={`relative transition-all duration-200 hover:-translate-y-0.5 ${isPopular ? "border-primary shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.08),0_4px_8px_-2px_rgb(0_0_0_/0.04)]" : "shadow-[0_1px_2px_0_rgb(0_0_0_/0.04),0_1px_3px_0_rgb(0_0_0_/0.08)]"}`}>
              {isPopular && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">הפופולרי ביותר</Badge>}
              <CardHeader>
                <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                <div>
                  <span className="text-3xl font-bold tabular-nums">${plan.price_monthly}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.connections === -1 ? "ללא הגבלה" : plan.limits.connections} ערוצים</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.brands === -1 ? "ללא הגבלה" : plan.limits.brands} מותגים</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.posts_per_month === -1 ? "ללא הגבלה" : plan.limits.posts_per_month} פוסטים/חודש</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.ai_credits === -1 ? "ללא הגבלה" : plan.limits.ai_credits} קרדיטים AI</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" />{plan.limits.members === -1 ? "ללא הגבלה" : plan.limits.members} חברי צוות</li>
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || plan.name === "enterprise"}
                  onClick={async () => {
                    if (!plan.stripe_price_id_monthly) {
                      toast.error("מחיר Stripe לא הוגדר לתוכנית זו");
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
                      else toast.error(data.error || "התשלום נכשל");
                    } catch { toast.error("התשלום נכשל"); }
                  }}
                >
                  {isCurrent ? "תוכנית נוכחית" : plan.name === "enterprise" ? "צרו קשר" : `שדרגו ל-${plan.display_name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
