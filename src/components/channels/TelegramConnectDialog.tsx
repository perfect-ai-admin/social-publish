"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess: () => void;
}

export function TelegramConnectDialog({ open, onOpenChange, workspaceId, onSuccess }: Props) {
  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim() || !channelId.trim()) return;

    setLoading(true);
    try {
      // Verify bot token by calling getMe
      const verifyRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const verifyData = await verifyRes.json();

      if (!verifyData.ok) {
        throw new Error("טוקן לא תקין. בדקו את הטוקן מ-@BotFather.");
      }

      const botName = verifyData.result.username;

      // Save connection
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

      toast.success(`בוט טלגרם @${botName} חובר!`);
      setBotToken("");
      setChannelId("");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "החיבור נכשל");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>חיבור טלגרם</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">איך להשיג Bot Token:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
              <li>פתחו טלגרם וחפשו את <strong>@BotFather</strong></li>
              <li>שלחו <code>/newbot</code> ועקבו אחר ההוראות</li>
              <li>העתיקו את הטוקן שקיבלתם</li>
              <li>הוסיפו את הבוט כמנהל לערוץ שלכם</li>
            </ol>
          </div>
          <div className="space-y-2">
            <Label>טוקן בוט</Label>
            <Input
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGhIJKlmNOPQRSTuvwXYZ"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>מזהה ערוץ או שם משתמש</Label>
            <Input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="@mychannel or -1001234567890"
              required
            />
            <p className="text-xs text-muted-foreground">
              השתמשו ב-@username לערוצים ציבוריים, או במזהה מספרי לערוצים פרטיים
            </p>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />מאמת...</> : "חיבור טלגרם"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
