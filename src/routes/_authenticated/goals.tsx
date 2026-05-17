import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Lock, MessageSquarePlus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeScore } from "@/lib/scoring";
import { checkinSchema, CYCLES } from "@/lib/validations";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/goals")({ component: GoalsPage });

function GoalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<string>("Q1");

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", user?.id, cycle],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*, checkins(*)")
        .eq("employee_id", user!.id)
        .eq("cycle", cycle)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalWeight = goals.reduce((s, g) => s + Number(g.weightage), 0);

  const remove = async (id: string) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({ action: "GOAL_DELETED", entity_type: "goal", entity_id: id });
    toast.success("Goal deleted");
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Goals</h1>
          <p className="text-sm text-muted-foreground">
            {goals.length}/8 goals · {totalWeight}% weightage allocated
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={cycle} onValueChange={setCycle}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Button asChild>
            <Link to="/goals/new" search={{ cycle } as never}><Plus className="h-4 w-4 mr-1" /> New goal</Link>
          </Button>
        </div>
      </div>

      {goals.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          No goals yet for {cycle}. Click "New goal" to add one.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {goals.map((g) => {
            const ck = g.checkins?.[0];
            const score = ck ? computeScore({
              uom: g.uom,
              target: Number(g.target),
              achievement: Number(ck.achievement_value),
              deadline: g.deadline,
              completionDate: ck.completion_date,
            }) : null;
            return (
              <Card key={g.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{g.title}</h3>
                        {g.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        <StatusBadge status={g.status} />
                        <Badge variant="outline" className="text-xs">{g.weightage}%</Badge>
                      </div>
                      {g.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{g.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>UoM: {g.uom}</span>
                        <span>Target: {g.target}</span>
                        {g.deadline && <span>Deadline: {new Date(g.deadline).toLocaleDateString()}</span>}
                        {ck && <span className="text-foreground font-medium">Achievement: {ck.achievement_value}</span>}
                        {score !== null && <span className="text-accent font-semibold">Score: {Math.round(score)}%</span>}
                      </div>
                      {g.manager_comments && (
                        <div className="mt-2 text-xs rounded-md bg-muted px-2 py-1">
                          <span className="font-medium">Manager: </span>{g.manager_comments}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <CheckinDialog goalId={g.id} disabled={g.status !== "APPROVED"} />
                      {!g.is_locked && (
                        <Button variant="ghost" size="icon" onClick={() => remove(g.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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

function CheckinDialog({ goalId, disabled }: { goalId: string; disabled: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const save = async () => {
    const parsed = checkinSchema.safeParse({ goal_id: goalId, achievement_value: val, completion_date: date });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    // load goal to compute score
    const { data: g } = await supabase.from("goals").select("*").eq("id", goalId).single();
    if (!g) return toast.error("Goal not found");
    const score = computeScore({
      uom: g.uom,
      target: Number(g.target),
      achievement: Number(val),
      deadline: g.deadline,
      completionDate: date,
    });

    const { error } = await supabase.from("checkins").insert({
      goal_id: goalId,
      achievement_value: Number(val),
      completion_date: date,
      score,
    });
    if (error) return toast.error(error.message);
    await logAudit({ action: "CHECKIN_CREATED", entity_type: "goal", entity_id: goalId, details: { score, achievement: Number(val) } });
    toast.success(`Check-in logged · score ${Math.round(score)}%`);
    setOpen(false); setVal("");
    qc.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} title={disabled ? "Goal must be approved" : "Log check-in"}>
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log a check-in</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Achievement value</Label><Input type="number" step="any" value={val} onChange={(e) => setVal(e.target.value)} /></div>
          <div><Label>Completion date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save}>Save check-in</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
