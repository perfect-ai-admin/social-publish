"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCalendarPosts } from "@/services/posts";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format,
  addMonths, subMonths, startOfWeek, endOfWeek,
  isToday, isSameMonth, isSameDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const workspaceId = getCurrentWorkspaceId();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const { data: posts = [] } = useQuery({
    queryKey: ["calendar-posts", workspaceId, format(monthStart, "yyyy-MM")],
    queryFn: () => getCalendarPosts(workspaceId!, calStart.toISOString(), calEnd.toISOString()),
    enabled: !!workspaceId,
  });

  const getPostsForDay = (day: Date) =>
    posts.filter((p) => p.scheduled_at && isSameDay(new Date(p.scheduled_at), day));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">לוח תוכן</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[150px] text-center font-medium">{format(currentMonth, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((d) => (
              <div key={d} className="border-s p-2 text-center text-xs font-medium text-muted-foreground first:border-s-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayPosts = getPostsForDay(day);
              return (
                <div key={i} className={cn("min-h-[100px] border-b border-s p-2 first:border-s-0", !isSameMonth(day, currentMonth) && "bg-muted/30 text-muted-foreground", isToday(day) && "bg-primary/5")}>
                  <span className={cn("text-sm", isToday(day) && "rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground font-medium")}>{format(day, "d")}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div key={post.id} className={cn("rounded px-1 py-0.5 text-[10px] truncate",
                        post.status === "published" && "bg-green-100 text-green-700",
                        post.status === "scheduled" && "bg-blue-100 text-blue-700",
                        post.status === "failed" && "bg-red-100 text-red-700",
                        post.status === "draft" && "bg-gray-100 text-gray-600",
                      )}>
                        {post.title || post.base_caption?.slice(0, 20) || "Post"}
                      </div>
                    ))}
                    {dayPosts.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayPosts.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {posts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-4">
              <CalendarDays className="h-6 w-6 text-gray-400" strokeWidth={1.5} />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">אין פוסטים מתוזמנים</p>
            <p className="text-sm text-gray-500 mb-4">תזמנו את הפוסט הראשון שלכם כדי לראות אותו כאן</p>
            <Link href="/composer">
              <Button>יצירת פוסט</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
