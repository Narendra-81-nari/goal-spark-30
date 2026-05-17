import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

function AdminPage() {
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["all-users"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role ?? "employee",
      }));
    },
  });

  const setRole = async (uid: string, newRole: "employee" | "manager" | "admin") => {
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: newRole });
    if (error) return toast.error(error.message);
    await logAudit({ action: "ROLE_CHANGED", entity_type: "user", entity_id: uid, details: { newRole } });
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["all-users"] });
  };

  const exportCsv = async () => {
    const { data: goals } = await supabase.from("goals").select("*, checkins(*)");
    if (!goals) return;
    const rows = [
      ["id", "employee_id", "title", "cycle", "weightage", "status", "target", "uom", "checkins"],
      ...goals.map((g) => [g.id, g.employee_id, g.title, g.cycle, g.weightage, g.status, g.target, g.uom, g.checkins?.length ?? 0]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `uberholes-report-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    await logAudit({ action: "REPORT_EXPORTED", details: { rows: goals.length } });
    toast.success(`Exported ${goals.length} goals`);
  };

  if (role !== "admin") return <p className="text-muted-foreground">Admin access required.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin & HR Console</h1>
          <p className="text-sm text-muted-foreground">Lifecycle configuration, role management, exports.</p>
        </div>
        <Button onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Users & Roles</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-sm">{u.full_name ?? u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{u.role}</Badge>
                  <Select value={u.role} onValueChange={(v) => setRole(u.id, v as never)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="py-8 text-center text-muted-foreground text-sm">No users yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
