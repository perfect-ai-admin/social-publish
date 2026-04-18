"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Heart, MessageCircle, Share2, MousePointerClick, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getWorkspaceAnalytics } from "@/services/analytics";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";

export default function AnalyticsPage() {
  const workspaceId = getCurrentWorkspaceId();
  const [days, setDays] = useState(30);

  const { data: analytics = [], isLoading } = useQuery({
    queryKey: ["analytics", workspaceId, days],
    queryFn: () => getWorkspaceAnalytics(workspaceId!, days),
    enabled: !!workspaceId,
  });

  const totals = analytics.reduce(
    (acc, a) => ({
      impressions: acc.impressions + (a.impressions ?? 0),
      likes: acc.likes + (a.likes ?? 0),
      comments: acc.comments + (a.comments ?? 0),
      shares: acc.shares + (a.shares ?? 0),
      clicks: acc.clicks + (a.clicks ?? 0),
      video_views: acc.video_views + (a.video_views ?? 0),
    }),
    { impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, video_views: 0 }
  );

  const rates = analytics.filter((a) => a.engagement_rate != null).map((a) => Number(a.engagement_rate));
  const avgRate = rates.length > 0 ? (rates.reduce((s, r) => s + r, 0) / rates.length).toFixed(2) : "0";

  const metricCards = [
    { title: "חשיפות", value: totals.impressions.toLocaleString(), icon: Eye, color: "text-blue-600" },
    { title: "לייקים", value: totals.likes.toLocaleString(), icon: Heart, color: "text-pink-600" },
    { title: "תגובות", value: totals.comments.toLocaleString(), icon: MessageCircle, color: "text-green-600" },
    { title: "שיתופים", value: totals.shares.toLocaleString(), icon: Share2, color: "text-purple-600" },
    { title: "קליקים", value: totals.clicks.toLocaleString(), icon: MousePointerClick, color: "text-amber-600" },
    { title: "אחוז מעורבות", value: `${avgRate}%`, icon: TrendingUp, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">אנליטיקות</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Badge
              key={d}
              variant={days === d ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setDays(d)}
            >
              {d} ימים
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((m) => (
          <Card key={m.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-20 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-2xl font-bold">{m.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">פוסטים מובילים</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.length === 0 ? (
              <p className="text-sm text-muted-foreground">פרסמו פוסטים כדי לראות אנליטיקות כאן.</p>
            ) : (
              <div className="space-y-2">
                {analytics
                  .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
                  .slice(0, 5)
                  .map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border p-2">
                      <div>
                        <Badge variant="secondary" className="text-[10px]">{a.platform}</Badge>
                        <p className="text-xs mt-1">{a.impressions.toLocaleString()} חשיפות</p>
                      </div>
                      <span className="text-sm font-medium">{Number(a.engagement_rate ?? 0).toFixed(2)}%</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">פילוח לפי פלטפורמה</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.length === 0 ? (
              <p className="text-sm text-muted-foreground">חברו ערוצים ופרסמו כדי לראות פילוח.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(
                  analytics.reduce((acc, a) => {
                    if (!acc[a.platform]) acc[a.platform] = { impressions: 0, engagement: 0, count: 0 };
                    acc[a.platform].impressions += a.impressions;
                    acc[a.platform].engagement += a.likes + a.comments + a.shares;
                    acc[a.platform].count++;
                    return acc;
                  }, {} as Record<string, { impressions: number; engagement: number; count: number }>)
                ).map(([platform, stats]) => (
                  <div key={platform} className="flex items-center justify-between rounded-lg border p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{platform}</Badge>
                      <span className="text-xs text-muted-foreground">{stats.count} פוסטים</span>
                    </div>
                    <span className="text-xs">{stats.impressions.toLocaleString()} חשיפות</span>
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
