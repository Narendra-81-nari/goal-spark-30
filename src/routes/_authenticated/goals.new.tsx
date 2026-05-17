import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { goalSchema, CYCLES, UOMS, MAX_GOALS_PER_EMPLOYEE, REQUIRED_TOTAL_WEIGHTAGE } from "@/lib/validations";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const searchSchema = z.object({ cycle: z.enum(CYCLES).default("Q1") });

export const Route = createFileRoute("/_authenticated/goals/new")({
  validateSearch: searchSchema,
  component: NewGoalPage,
});

function NewGoalPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { cycle: defaultCycle } = Route.useSearch();
  const [form, setForm] = useState({
    title: "",
    description: "",
    target: "",
    weightage: "",
    uom: "HIGHER_BETTER" as typeof UOMS[number],
    cycle: defaultCycle,
    deadline: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = goalSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!user) return;

    setBusy(true);
    // Server-side validation logic enforced via client RLS + checks
    const { data: existing } = await supabase
      .from("goals")
      .select("id, weightage")
      .eq("employee_id", user.id)
      .eq("cycle", parsed.data.cycle);

    if ((existing?.length ?? 0) >= MAX_GOALS_PER_EMPLOYEE) {
      setBusy(false);
      return toast.error(`Max ${MAX_GOALS_PER_EMPLOYEE} goals per cycle`);
    }
    const currentTotal = (existing ?? []).reduce((s, g) => s + Number(g.weightage), 0);
    if (currentTotal + parsed.data.weightage > REQUIRED_TOTAL_WEIGHTAGE) {
      setBusy(false);
      return toast.error(`Weightage would exceed 100% (current: ${currentTotal}%)`);
    }

    const { data, error } = await supabase
      .from("goals")
      .insert({
        employee_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        target: parsed.data.target,
        weightage: parsed.data.weightage,
        uom: parsed.data.uom,
        cycle: parsed.data.cycle,
        deadline: parsed.data.deadline || null,
      })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    await logAudit({ action: "GOAL_CREATED", entity_type: "goal", entity_id: data.id, details: { weightage: parsed.data.weightage } });
    toast.success("Goal submitted for approval");
    nav({ to: "/goals" });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-6">New goal</h1>
      <Card>
        <CardHeader><CardTitle>Define your objective</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div><Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Target</Label>
                <Input type="number" step="any" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
              </div>
              <div><Label>Weightage (%)</Label>
                <Input type="number" min={10} max={100} value={form.weightage} onChange={(e) => setForm({ ...form, weightage: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>UoM type</Label>
                <Select value={form.uom} onValueChange={(v) => setForm({ ...form, uom: v as typeof UOMS[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGHER_BETTER">Higher-better</SelectItem>
                    <SelectItem value="LOWER_BETTER">Lower-better</SelectItem>
                    <SelectItem value="TIMELINE">Timeline</SelectItem>
                    <SelectItem value="ZERO_BASED">Zero-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cycle</Label>
                <Select value={form.cycle} onValueChange={(v) => setForm({ ...form, cycle: v as typeof CYCLES[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Deadline</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => nav({ to: "/goals" })}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for approval"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
