"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Shield, Users, Globe, Bell, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace, getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const roles = [
  { name: "בעלים", description: "גישה מלאה, חיוב, מחיקת סביבת עבודה", color: "text-red-600" },
  { name: "מנהל", description: "ניהול ערוצים, חברים, הגדרות", color: "text-orange-600" },
  { name: "עורך", description: "יצירה ופרסום תוכן", color: "text-blue-600" },
  { name: "צופה", description: "צפייה באנליטיקות ותוכן בלבד", color: "text-gray-600" },
];

export default function SettingsPage() {
  const workspaceId = getCurrentWorkspaceId();
  const { data: workspace, isLoading } = useWorkspace(workspaceId);
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setTimezone(workspace.timezone);
    }
  }, [workspace]);

  // Fetch members
  const { data: members = [] } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await createClient()
        .from("workspaces")
        .update({ name, timezone })
        .eq("id", workspaceId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("ההגדרות נשמרו");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">הגדרות</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Globe className="h-4 w-4" />סביבת עבודה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>שם סביבת העבודה</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>אזור זמן</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">תוכנית:</span>
            <Badge variant="outline">{workspace?.plan ?? "starter"}</Badge>
            <span className="text-xs text-muted-foreground">מזהה:</span>
            <Badge variant="outline">{workspace?.slug}</Badge>
          </div>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            שמירת שינויים
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-4 w-4" />חברי צוות ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין חברי צוות עדיין.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{m.user_id}</p>
                    <p className="text-xs text-muted-foreground">הצטרף {new Date(m.joined_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="outline">{m.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Shield className="h-4 w-4" />תפקידים והרשאות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roles.map((role) => (
              <div key={role.name} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className={`font-medium ${role.color}`}>{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
                <Badge variant="outline">{role.name}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
