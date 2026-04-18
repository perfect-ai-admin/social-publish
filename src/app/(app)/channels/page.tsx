"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_CAPABILITIES, type Platform, PLATFORMS } from "@/lib/platform-capabilities";
import { Plus, CheckCircle2, Unplug } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listConnections, deleteConnection } from "@/services/channels";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import { TelegramConnectDialog } from "@/components/channels/TelegramConnectDialog";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

export default function ChannelsPage() {
  return <Suspense><ChannelsContent /></Suspense>;
}

function ChannelsContent() {
  const workspaceId = getCurrentWorkspaceId();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [telegramOpen, setTelegramOpen] = useState(false);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) toast.success(`חובר בהצלחה!`);
    if (error) toast.error("החיבור נכשל. נסו שוב.");
  }, [searchParams]);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections", workspaceId],
    queryFn: () => listConnections(workspaceId!),
    enabled: !!workspaceId,
  });

  const disconnectMutation = useMutation({
    mutationFn: deleteConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      toast.success("הערוץ נותק");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Only count active connections — allow reconnect for expired/error
  const connectedPlatforms = new Set(connections.filter((c) => c.status === "active").map((c) => c.platform));

  const handleConnect = (platform: Platform) => {
    if (!workspaceId) return;
    if (platform === "facebook" || platform === "instagram") {
      window.location.href = `/api/oauth/meta?workspace_id=${workspaceId}`;
    } else if (platform === "youtube" || platform === "google_business") {
      window.location.href = `/api/oauth/google?workspace_id=${workspaceId}&platform=${platform}`;
    } else if (platform === "telegram") {
      setTelegramOpen(true);
      return;
    } else {
      toast.info(`${PLATFORM_CAPABILITIES[platform].label} חיבור בקרוב`);
    }
  };

  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ערוצים</h1>
        <Badge variant="outline">{connections.length} מחוברים</Badge>
      </div>

      {connections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">מחוברים</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {connections.map((ch) => {
              const cap = PLATFORM_CAPABILITIES[ch.platform];
              const isExpiring = ch.token_expires_at && new Date(ch.token_expires_at) < soonThreshold;
              const isError = ch.status !== "active";
              return (
                <Card key={ch.id} className={isError ? "border-red-200" : isExpiring ? "border-amber-200" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-sm font-bold shrink-0" style={{ backgroundColor: cap?.color ?? "#666" }}>
                        {(cap?.label ?? ch.platform)[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{ch.platform_account_name || ch.platform}</p>
                        <p className="text-xs text-muted-foreground">{cap?.label}</p>
                        {ch.token_expires_at && <p className="text-[10px] text-muted-foreground">פג תוקף: {new Date(ch.token_expires_at).toLocaleDateString()}</p>}
                        {ch.last_error && <p className="text-[10px] text-red-500 truncate">{ch.last_error}</p>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge variant={isError ? "destructive" : isExpiring ? "secondary" : "default"} className="text-[10px]">
                          {isError ? "שגיאה" : isExpiring ? "פג בקרוב" : "פעיל"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (confirm("לנתק ערוץ זה?")) disconnectMutation.mutate(ch.id); }}>
                          <Unplug className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">חיבור ערוץ</h2>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (<Card key={i}><CardContent className="p-4"><div className="h-16 animate-pulse rounded bg-muted" /></CardContent></Card>))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {PLATFORMS.map((key) => {
              const cap = PLATFORM_CAPABILITIES[key];
              const isConnected = connectedPlatforms.has(key);
              return (
                <Card key={key} className={`transition-colors ${isConnected ? "opacity-60" : "hover:border-primary/50"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-sm font-bold shrink-0" style={{ backgroundColor: cap.color }}>{cap.label[0]}</div>
                      <div className="flex-1">
                        <p className="font-medium">{cap.label}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {cap.supportsImages && <Badge variant="secondary" className="text-[10px]">Images</Badge>}
                          {cap.supportsVideo && <Badge variant="secondary" className="text-[10px]">Video</Badge>}
                          {cap.supportsCarousel && <Badge variant="secondary" className="text-[10px]">Carousel</Badge>}
                          {cap.supportsReels && <Badge variant="secondary" className="text-[10px]">Reels</Badge>}
                        </div>
                        {cap.requiresPartnerApproval && <p className="mt-1 text-[10px] text-amber-600">דורש אישור שותף</p>}
                      </div>
                      <Button size="sm" variant={isConnected ? "outline" : "default"} disabled={isConnected} onClick={() => handleConnect(key)}>
                        {isConnected ? <><CheckCircle2 className="mr-1 h-3 w-3" />מחוברים</> : <><Plus className="mr-1 h-3 w-3" />חבר</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {workspaceId && (
        <TelegramConnectDialog
          open={telegramOpen}
          onOpenChange={setTelegramOpen}
          workspaceId={workspaceId}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["connections"] })}
        />
      )}
    </div>
  );
}
