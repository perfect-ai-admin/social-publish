"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, XCircle, RefreshCw, CheckCircle2, Unplug, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorLogs, getFailedJobs, getExpiredConnections, resolveError } from "@/services/errors";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import { PLATFORM_CAPABILITIES, type Platform } from "@/lib/platform-capabilities";
import { toast } from "sonner";

export default function ErrorCenterPage() {
  const workspaceId = getCurrentWorkspaceId();
  const queryClient = useQueryClient();

  const { data: errors = [], isLoading: errorsLoading } = useQuery({
    queryKey: ["error-logs", workspaceId],
    queryFn: () => getErrorLogs(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: failedJobs = [] } = useQuery({
    queryKey: ["failed-jobs", workspaceId],
    queryFn: () => getFailedJobs(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: expiredConns = [] } = useQuery({
    queryKey: ["expired-connections", workspaceId],
    queryFn: () => getExpiredConnections(workspaceId!),
    enabled: !!workspaceId,
  });

  const resolveMutation = useMutation({
    mutationFn: resolveError,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["error-logs"] });
      toast.success("השגיאה סומנה כפתורה");
    },
  });

  const unresolvedCount = errors.filter((e) => !e.resolved).length;
  const totalIssues = unresolvedCount + failedJobs.length + expiredConns.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">מרכז שגיאות</h1>
        <Badge variant={totalIssues > 0 ? "destructive" : "default"}>
          {totalIssues} {totalIssues !== 1 ? "בעיות" : "בעיה"}
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-[0_1px_2px_0_rgb(0_0_0_/0.04),0_1px_3px_0_rgb(0_0_0_/0.08)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">פרסומים שנכשלו</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50"><XCircle className="h-5 w-5 text-red-500" strokeWidth={1.75} /></div>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{failedJobs.length}</div></CardContent>
        </Card>
        <Card className="shadow-[0_1px_2px_0_rgb(0_0_0_/0.04),0_1px_3px_0_rgb(0_0_0_/0.08)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">חיבורים שפגו</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50"><Unplug className="h-5 w-5 text-amber-500" strokeWidth={1.75} /></div>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{expiredConns.length}</div></CardContent>
        </Card>
        <Card className="shadow-[0_1px_2px_0_rgb(0_0_0_/0.04),0_1px_3px_0_rgb(0_0_0_/0.08)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">שגיאות פתוחות</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50"><AlertTriangle className="h-5 w-5 text-orange-500" strokeWidth={1.75} /></div>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{unresolvedCount}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="failed">
        <TabsList>
          <TabsTrigger value="failed">משימות שנכשלו ({failedJobs.length})</TabsTrigger>
          <TabsTrigger value="connections">חיבורים ({expiredConns.length})</TabsTrigger>
          <TabsTrigger value="errors">יומן שגיאות ({unresolvedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="failed" className="space-y-2 mt-4">
          {failedJobs.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">אין משימות שנכשלו</CardContent></Card>
          ) : (
            failedJobs.map((job) => (
              <Card key={job.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={job.status === "dead" ? "destructive" : "secondary"} className="text-[10px]">
                        {job.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ניסיון {job.attempt_number}/{job.max_attempts}
                      </span>
                    </div>
                    {job.error && <p className="text-sm text-red-600 mt-1 truncate">{job.error}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                  {job.next_attempt_at && job.status !== "dead" && (
                    <Badge variant="outline" className="text-[10px] ms-2 gap-1">
                      <RefreshCw className="h-3 w-3" />
                      מנסה שוב {new Date(job.next_attempt_at).toLocaleTimeString()}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="connections" className="space-y-2 mt-4">
          {expiredConns.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">כל החיבורים תקינים</CardContent></Card>
          ) : (
            expiredConns.map((conn) => {
              const cap = PLATFORM_CAPABILITIES[conn.platform as Platform];
              return (
                <Card key={conn.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md text-white text-xs font-bold" style={{ backgroundColor: cap?.color ?? "#666" }}>
                      {(cap?.label ?? conn.platform)[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{conn.platform_account_name || conn.platform}</p>
                      <p className="text-xs text-red-500">{conn.last_error || `Status: ${conn.status}`}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => window.location.href = "/channels"}>
                      חיבור מחדש
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-2 mt-4">
          {errorsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : errors.filter((e) => !e.resolved).length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">אין שגיאות פתוחות</CardContent></Card>
          ) : (
            errors.filter((e) => !e.resolved).map((err) => (
              <Card key={err.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{err.error_type}</Badge>
                      {err.error_code && <Badge variant="secondary" className="text-[10px]">{err.error_code}</Badge>}
                    </div>
                    <p className="text-sm mt-1">{err.error_message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(err.created_at).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => resolveMutation.mutate(err.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />פתור
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
