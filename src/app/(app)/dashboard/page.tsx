"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CalendarDays, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getWorkspaceKPIs, getRecentActivity, getConnectionHealth } from "@/services/dashboard";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import { PLATFORM_CAPABILITIES, type Platform } from "@/lib/platform-capabilities";
import Link from "next/link";

export default function DashboardPage() {
  const workspaceId = getCurrentWorkspaceId();

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["dashboard-kpis", workspaceId],
    queryFn: () => getWorkspaceKPIs(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: recentPosts } = useQuery({
    queryKey: ["dashboard-recent", workspaceId],
    queryFn: () => getRecentActivity(workspaceId!, 5),
    enabled: !!workspaceId,
  });

  const { data: channels } = useQuery({
    queryKey: ["dashboard-health", workspaceId],
    queryFn: () => getConnectionHealth(workspaceId!),
    enabled: !!workspaceId,
  });

  const stats = [
    { title: "פורסמו", value: kpis?.totalPublished ?? 0, icon: CheckCircle2, color: "text-green-600" },
    { title: "מתוזמנים", value: kpis?.totalScheduled ?? 0, icon: CalendarDays, color: "text-blue-600" },
    { title: "נכשלו", value: kpis?.totalFailed ?? 0, icon: AlertTriangle, color: "text-red-600" },
    { title: "אחוז מעורבות", value: `${kpis?.avgEngagementRate ?? 0}%`, icon: BarChart3, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">לוח בקרה</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {kpisLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Posts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">פוסטים אחרונים</CardTitle>
            <Link href="/composer" className="text-xs text-primary hover:underline">
              יצירת פוסט
            </Link>
          </CardHeader>
          <CardContent>
            {!recentPosts?.length ? (
              <p className="text-sm text-muted-foreground">
                אין פוסטים עדיין. צרו את הפוסט הראשון שלכם.
              </p>
            ) : (
              <div className="space-y-3">
                {recentPosts.map((post) => (
                  <div key={post.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {post.title || post.base_caption?.slice(0, 60) || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString()
                          : post.scheduled_at
                            ? `מתוזמן: ${new Date(post.scheduled_at).toLocaleDateString()}`
                            : "טיוטה"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        post.status === "published" ? "default" :
                        post.status === "scheduled" ? "secondary" :
                        post.status === "failed" ? "destructive" : "outline"
                      }
                      className="text-xs ml-2"
                    >
                      {post.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channel Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">בריאות ערוצים</CardTitle>
            <Link href="/channels" className="text-xs text-primary hover:underline">
              נהל
            </Link>
          </CardHeader>
          <CardContent>
            {!channels?.length ? (
              <p className="text-sm text-muted-foreground">
                אין ערוצים מחוברים.{" "}
                <Link href="/channels" className="text-primary hover:underline">חברו את הערוץ הראשון</Link>
              </p>
            ) : (
              <div className="space-y-2">
                {channels.map((ch) => (
                  <div key={ch.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md text-white text-xs font-bold"
                      style={{ backgroundColor: PLATFORM_CAPABILITIES[ch.platform as Platform]?.color ?? "#666" }}
                    >
                      {(PLATFORM_CAPABILITIES[ch.platform as Platform]?.label ?? ch.platform)[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ch.platform_account_name || ch.platform}</p>
                    </div>
                    <Badge
                      variant={ch.health === "healthy" ? "default" : ch.health === "expiring" ? "secondary" : "destructive"}
                      className="text-[10px]"
                    >
                      {ch.health === "healthy" ? "פעיל" : ch.health === "expiring" ? "פג בקרוב" : "שגיאה"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
