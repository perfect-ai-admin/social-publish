"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_CAPABILITIES, type Platform, PLATFORMS } from "@/lib/platform-capabilities";
import { Plus, CheckCircle2, Unplug, Lock, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listConnections, deleteConnection } from "@/services/channels";
import { useEnsureWorkspace } from "@/hooks/useWorkspace";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

// All platforms with OAuth routes built
const READY_PLATFORMS: Platform[] = [
  "facebook", "instagram", "youtube", "google_business", "telegram",
  "tiktok", "linkedin", "pinterest", "x", "threads", "reddit",
];
// These need special handling (not standard OAuth)
const SPECIAL_PLATFORMS: Platform[] = ["whatsapp", "snapchat"];

export default function ChannelsPage() {
  return <Suspense><ChannelsContent /></Suspense>;
}

function ChannelsContent() {
  const workspaceId = useEnsureWorkspace();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [telegramLoading, setTelegramLoading] = useState(false);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) toast.success(`${connected} חובר בהצלחה!`);
    if (error === "csrf_mismatch") toast.error("שגיאת אבטחה — נסו שוב");
    if (error === "oauth_failed") toast.error("החיבור נכשל. ודאו שהגדרתם את ה-credentials");
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

  const connectedPlatforms = new Set(connections.filter((c) => c.status === "active").map((c) => c.platform));

  const handleConnect = (platform: Platform) => {
    if (!workspaceId) {
      toast.error("לא נמצאה סביבת עבודה — רעננו את הדף");
      return;
    }

    switch (platform) {
      case "facebook":
      case "instagram":
        window.location.href = `/api/oauth/meta?workspace_id=${workspaceId}`;
        break;
      case "youtube":
        window.location.href = `/api/oauth/google?workspace_id=${workspaceId}&platform=youtube`;
        break;
      case "google_business":
        window.location.href = `/api/oauth/google?workspace_id=${workspaceId}&platform=google_business`;
        break;
      case "telegram":
        setTelegramOpen(true);
        break;
      case "tiktok":
        window.location.href = `/api/oauth/tiktok?workspace_id=${workspaceId}`;
        break;
      case "linkedin":
        window.location.href = `/api/oauth/linkedin?workspace_id=${workspaceId}`;
        break;
      case "pinterest":
        window.location.href = `/api/oauth/pinterest?workspace_id=${workspaceId}`;
        break;
      case "x":
        window.location.href = `/api/oauth/x?workspace_id=${workspaceId}`;
        break;
      case "threads":
        window.location.href = `/api/oauth/threads?workspace_id=${workspaceId}`;
        break;
      case "reddit":
        window.location.href = `/api/oauth/reddit?workspace_id=${workspaceId}`;
        break;
      case "whatsapp":
        toast.info("WhatsApp Business — חיבור דרך Meta Business Suite. הגדירו META_APP_ID");
        break;
      case "snapchat":
        toast.info("Snapchat — דורש Snap Kit Developer Account");
        break;
    }
  };

  const handleTelegramConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim() || !channelId.trim() || !workspaceId) return;

    setTelegramLoading(true);
    try {
      const verifyRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const verifyData = await verifyRes.json();
      if (!verifyData.ok) throw new Error("טוקן לא תקין. בדקו את הטוקן מ-@BotFather");

      const botName = verifyData.result.username;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("platform_connections").upsert({
        workspace_id: workspaceId,
        platform: "telegram",
        platform_account_id: channelId,
        platform_account_name: `@${botName}`,
        platform_account_type: "bot",
        access_token: botToken,
        status: "active",
        scopes: ["send_message", "send_photo", "send_video"],
        connected_by: user?.id,
        connected_at: new Date().toISOString(),
        metadata: { bot_username: botName, channel_id: channelId },
      }, { onConflict: "workspace_id,platform,platform_account_id" });

      if (error) throw error;

      toast.success(`בוט טלגרם @${botName} חובר בהצלחה!`);
      setBotToken("");
      setChannelId("");
      setTelegramOpen(false);
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "החיבור נכשל");
    } finally {
      setTelegramLoading(false);
    }
  };

  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">ערוצים</h1>
        <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">טוען סביבת עבודה...</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">ערוצים</h1>
        <Badge variant="outline">{connections.length} מחוברים</Badge>
      </div>

      {/* Connected channels */}
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

      {/* Telegram inline connect form */}
      {telegramOpen && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>חיבור טלגרם</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setTelegramOpen(false)}>✕</Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTelegramConnect} className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium mb-1">איך להשיג Bot Token:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                  <li>פתחו טלגרם וחפשו את <strong>@BotFather</strong></li>
                  <li>שלחו <code>/newbot</code> ועקבו אחר ההוראות</li>
                  <li>העתיקו את הטוקן שקיבלתם</li>
                  <li>הוסיפו את הבוט כמנהל לערוץ שלכם</li>
                </ol>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>טוקן בוט</Label>
                  <Input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123456789:ABCdefGhIJKlmNOPQRSTuvwXYZ" required />
                </div>
                <div className="space-y-2">
                  <Label>מזהה ערוץ או שם משתמש</Label>
                  <Input value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="@mychannel" required />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="gap-2" disabled={telegramLoading}>
                  {telegramLoading ? <><Loader2 className="h-4 w-4 animate-spin" />מאמת...</> : "חיבור טלגרם"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setTelegramOpen(false)}>ביטול</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Available platforms */}
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
              const isReady = READY_PLATFORMS.includes(key) || !SPECIAL_PLATFORMS.includes(key);

              return (
                <Card key={key} className={`transition-colors ${isConnected ? "opacity-60" : isReady ? "hover:border-primary/50" : "opacity-70"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-sm font-bold shrink-0" style={{ backgroundColor: cap.color }}>
                        {cap.label[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium">{cap.label}</p>
                          {!isReady && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {cap.supportsText && <Badge variant="secondary" className="text-[10px]">טקסט</Badge>}
                          {cap.supportsImages && <Badge variant="secondary" className="text-[10px]">תמונות</Badge>}
                          {cap.supportsVideo && <Badge variant="secondary" className="text-[10px]">וידאו</Badge>}
                          {cap.supportsCarousel && <Badge variant="secondary" className="text-[10px]">קרוסלה</Badge>}
                          {cap.supportsReels && <Badge variant="secondary" className="text-[10px]">Reels</Badge>}
                          {cap.supportsStories && <Badge variant="secondary" className="text-[10px]">סטורי</Badge>}
                        </div>
                        {!isReady && <p className="mt-1 text-[10px] text-amber-600">בקרוב</p>}
                        {cap.requiresPartnerApproval && isReady && <p className="mt-1 text-[10px] text-amber-600">דורש אישור שותף</p>}
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        variant={isConnected ? "outline" : isReady ? "default" : "secondary"}
                        disabled={isConnected}
                        onClick={() => handleConnect(key)}
                      >
                        {isConnected ? (
                          <><CheckCircle2 className="h-3 w-3" />מחובר</>
                        ) : isReady ? (
                          <><Plus className="h-3 w-3" />חבר</>
                        ) : (
                          <><Lock className="h-3 w-3" />בקרוב</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
