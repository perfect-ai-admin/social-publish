"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">משהו השתבש</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {error.message || "אירעה שגיאה לא צפויה"}
          </p>
          <div className="flex gap-2">
            <Button onClick={reset}>נסו שוב</Button>
            <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
              ללוח הבקרה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
