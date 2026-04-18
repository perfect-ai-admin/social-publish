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
        throw new Error("Invalid bot token. Check your token from @BotFather.");
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

      toast.success(`Telegram bot @${botName} connected!`);
      setBotToken("");
      setChannelId("");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Telegram</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">How to get a Bot Token:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
              <li>Open Telegram and search for <strong>@BotFather</strong></li>
              <li>Send <code>/newbot</code> and follow the instructions</li>
              <li>Copy the API token you receive</li>
              <li>Add the bot as admin to your channel</li>
            </ol>
          </div>
          <div className="space-y-2">
            <Label>Bot Token</Label>
            <Input
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGhIJKlmNOPQRSTuvwXYZ"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Channel ID or Username</Label>
            <Input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="@mychannel or -1001234567890"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use @username for public channels, or the numeric ID for private channels
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Connect Telegram"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
