import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { createServiceRoleClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceRoleClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspace_id;
      const planName = session.metadata?.plan_name;
      if (!workspaceId || !planName) break;

      await supabase.from("workspace_subscriptions").upsert({
        workspace_id: workspaceId,
        plan_name: planName,
        stripe_subscription_id: session.subscription as string,
        stripe_customer_id: session.customer as string,
        status: "active",
        current_period_start: new Date().toISOString(),
      }, { onConflict: "workspace_id" });

      await supabase.from("workspaces").update({ plan: planName }).eq("id", workspaceId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from("workspace_subscriptions")
        .update({
          status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "cancelled",
          cancel_at_period_end: sub.cancel_at_period_end,
          current_period_start: new Date((sub as any).current_period_start * 1000).toISOString(),
          current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from("workspace_subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("stripe_subscription_id", sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
