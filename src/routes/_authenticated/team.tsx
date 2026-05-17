import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Split, Lock } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/team")({ component: TeamPage });

function TeamPage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const { data: goals = [] } = useQuery({
    queryKey: ["team-goals", user?.id],
    enabled: !!user?.id && (role === "manager" || role === "admin"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*, checkins(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((g) => g.employee_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((g) => ({ ...g, profile: map.get(g.employee_id) }));
    },
  });

  const decide = async (id: string, decision: "APPROVED" | "REJECTED", comments?: string) => {
    const { error } = await supabase
      .from("goals")
      .update({
        status: decision,
        is_locked: decision === "APPROVED",
        manager_comments: comments ?? null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({ action: `GOAL_${decision}`, entity_type: "goal", entity_id: id, details: { comments } });
    toast.success(`Goal ${decision.toLowerCase()}`);
    qc.invalidateQueries({ queryKey: ["team-goals"] });
  };

  if (role !== "manager" && role !== "admin") {
    return <p className="text-muted-foreground">Manager access required.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Dashboard</h1>
        <p className="text-sm text-muted-foreground">Review, approve, split or fork goals across your reports.</p>
      </div>

      {goals.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No team goals to review.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {goals.map((g) => {
            const profile = (g as any).profile as { full_name?: string; email?: string } | undefined;
            return (
              <Card key={g.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{g.title}</h3>
                        {g.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        <Badge variant="outline" className="text-xs">{g.cycle}</Badge>
                        <Badge variant="outline" className="text-xs">{g.weightage}%</Badge>
                        <StatusBadge status={g.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {profile?.full_name ?? profile?.email ?? "Unknown employee"} · target {g.target} · {g.uom}
                      </div>
                      {g.description && <p className="mt-2 text-sm text-muted-foreground">{g.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      {g.status === "PENDING" && (
                        <>
                          <DecisionDialog onSubmit={(c) => decide(g.id, "APPROVED", c)} label="Approve" tone="success" />
                          <DecisionDialog onSubmit={(c) => decide(g.id, "REJECTED", c)} label="Reject" tone="destructive" />
                        </>
                      )}
                      <ShareDialog goal={g} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-warning/15 text-warning border-warning/30",
    APPROVED: "bg-success/15 text-success border-success/30",
    REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status]}`}>{status}</span>;
}

function DecisionDialog({ onSubmit, label, tone }: { onSubmit: (c: string) => void; label: string; tone: "success" | "destructive" }) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState("");
  const Icon = tone === "success" ? Check : X;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={label} className={tone === "success" ? "text-success hover:text-success" : "text-destructive hover:text-destructive"}>
          <Icon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{label} goal</DialogTitle></DialogHeader>
        <div><Label>Comments</Label><Textarea value={c} onChange={(e) => setC(e.target.value)} /></div>
        <DialogFooter><Button onClick={() => { onSubmit(c); setOpen(false); }}>{label}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ goal }: { goal: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pct, setPct] = useState("50");

  const share = async () => {
    const { data: target } = await supabase.from("profiles").select("id").eq("email", email).single();
    if (!target) return toast.error("Employee not found");

    const allocation = Number(pct);
    if (allocation < 10 || allocation > 100) return toast.error("Allocation must be 10–100");

    // Create child goal
    const { data: child, error: cerr } = await supabase.from("goals").insert({
      employee_id: target.id,
      title: `[Shared] ${goal.title}`,
      description: goal.description,
      target: (Number(goal.target) * allocation) / 100,
      weightage: Math.max(10, (Number(goal.weightage) * allocation) / 100),
      uom: goal.uom,
      cycle: goal.cycle,
      deadline: goal.deadline,
    }).select().single();
    if (cerr) return toast.error(cerr.message);

    const { error: serr } = await supabase.from("shared_goals").insert({
      original_goal_id: goal.id,
      child_goal_id: child.id,
      is_split_forked: true,
      slocked: true,
      allocation_pct: allocation,
    });
    if (serr) return toast.error(serr.message);

    await logAudit({ action: "GOAL_SHARED", entity_type: "goal", entity_id: goal.id, details: { to: target.id, allocation } });
    toast.success("Goal split & shared");
    setOpen(false);
    qc.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Split / fork to another employee">
          <Split className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Split & fork goal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Employee email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alice@company.com" /></div>
          <div><Label>Allocation %</Label><Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Creates a frozen ("slocked") child goal on the target employee with proportional target & weightage.</p>
        </div>
        <DialogFooter><Button onClick={share}>Share goal</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
