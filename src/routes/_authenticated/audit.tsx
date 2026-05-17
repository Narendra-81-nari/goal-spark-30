import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/audit")({ component: AuditPage });

function AuditPage() {
  const { role } = useAuth();
  const [q, setQ] = useState("");

  const { data: logs = [] } = useQuery({
    queryKey: ["audit"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (role !== "admin") return <p className="text-muted-foreground">Admin access required.</p>;

  const filtered = logs.filter((l) =>
    !q || l.action.toLowerCase().includes(q.toLowerCase()) ||
    JSON.stringify(l.details ?? {}).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">{logs.length} events · system-wide ledger</p>
      </div>

      <Input placeholder="Search action or details…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filtered.map((l) => (
              <div key={l.id} className="flex items-start gap-4 p-4">
                <Badge variant="outline" className="font-mono text-[10px]">{l.action}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{new Date(l.timestamp).toLocaleString()}</div>
                  {l.entity_type && <div className="text-xs">on {l.entity_type} <code className="text-muted-foreground">{l.entity_id?.slice(0, 8)}</code></div>}
                  {l.details && Object.keys(l.details as object).length > 0 && (
                    <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(l.details, null, 2)}</pre>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="py-12 text-center text-muted-foreground text-sm">No matching events.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
