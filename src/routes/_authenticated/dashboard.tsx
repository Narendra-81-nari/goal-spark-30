import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { computeScore, weightedScore } from "@/lib/scoring";
import { Target, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, role } = useAuth();

  const { data: goals = [] } = useQuery({
    queryKey: ["my-goals", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*, checkins(*)")
        .eq("employee_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalWeight = goals.reduce((s, g) => s + Number(g.weightage), 0);
  const approved = goals.filter((g) => g.status === "APPROVED").length;
  const pending = goals.filter((g) => g.status === "PENDING").length;

  const compositeScore = goals.reduce((acc, g) => {
    const ck = g.checkins?.[0];
    if (!ck) return acc;
    const s = computeScore({
      uom: g.uom,
      target: Number(g.target),
      achievement: Number(ck.achievement_value),
      deadline: g.deadline,
      completionDate: ck.completion_date,
    });
    return acc + weightedScore(s, Number(g.weightage));
  }, 0);

  const chart = goals.map((g) => {
    const ck = g.checkins?.[0];
    const score = ck ? computeScore({
      uom: g.uom,
      target: Number(g.target),
      achievement: Number(ck.achievement_value),
      deadline: g.deadline,
      completionDate: ck.completion_date,
    }) : 0;
    return { name: g.title.slice(0, 12), score: Math.round(score), target: 100 };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Your appraisal snapshot · role: <span className="capitalize font-medium">{role}</span></p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Target} label="Total goals" value={goals.length} sub={`${totalWeight}% weightage`} />
        <Stat icon={CheckCircle2} label="Approved" value={approved} sub="locked" tone="success" />
        <Stat icon={AlertCircle} label="Pending" value={pending} sub="awaiting review" tone="warning" />
        <Stat icon={TrendingUp} label="Composite" value={`${Math.round(compositeScore)}%`} sub="weighted score" tone="accent" />
      </div>

      <Card>
        <CardHeader><CardTitle>Goal Setting Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span>Weightage allocated</span>
            <span className={totalWeight === 100 ? "text-success" : "text-warning"}>{totalWeight}% / 100%</span>
          </div>
          <Progress value={Math.min(totalWeight, 100)} />
          <p className="mt-2 text-xs text-muted-foreground">
            Total combined weightage must equal exactly 100% and each goal must be at least 10%. Maximum 8 goals.
          </p>
        </CardContent>
      </Card>

      {chart.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Planned vs Actual</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Bar dataKey="target" fill="var(--muted)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="score" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone = "default" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string; tone?: "default" | "success" | "warning" | "accent";
}) {
  const toneCls = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    accent: "text-accent",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${toneCls}`} />
        </div>
        <div className={`mt-2 text-2xl font-bold ${toneCls}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
