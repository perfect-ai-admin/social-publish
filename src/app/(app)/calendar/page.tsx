"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
        <h1 className="text-2xl font-bold">Content Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[150px] text-center font-medium">{format(currentMonth, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="border-r p-2 text-center text-xs font-medium text-muted-foreground last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayPosts = getPostsForDay(day);
              return (
                <div key={i} className={cn("min-h-[100px] border-b border-r p-2 last:border-r-0", !isSameMonth(day, currentMonth) && "bg-muted/30 text-muted-foreground", isToday(day) && "bg-primary/5")}>
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
        <div className="text-center py-8">
          <p className="text-muted-foreground">No scheduled posts this month</p>
          <Link href="/composer" className="text-sm text-primary hover:underline mt-2 inline-block">Create your first post</Link>
        </div>
      )}
    </div>
  );
}
