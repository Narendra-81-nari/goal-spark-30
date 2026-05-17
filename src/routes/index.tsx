import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Target, CheckCircle2, Users, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold">U</div>
            <span className="font-semibold tracking-tight">UberHoles</span>
          </div>
          <div className="flex gap-2">
            <Link to="/login" className="rounded-md px-4 py-2 text-sm hover:bg-secondary">Sign in</Link>
            <Link to="/signup" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Get started</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">ATOMQUEST · Goal Portal 1.0</span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Set goals. Track progress.<br />
            <span className="text-accent">Score performance.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            An in-house portal for quarterly goal setting, manager approvals,
            check-ins, weighted scoring, and audit-grade transparency.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/signup" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Start your appraisal cycle
            </Link>
            <Link to="/login" className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-secondary">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: Target, t: "Quarterly goals", d: "Up to 8 goals per employee with weighted 100% target." },
            { i: CheckCircle2, t: "Manager approvals", d: "Approve, reject, or return-for-rework with comments." },
            { i: BarChart3, t: "Scoring engines", d: "Higher-better, lower-better, timeline, zero-based UoMs." },
            { i: Users, t: "Split & fork", d: "Share team goals across reports with allocation tracking." },
          ].map((f) => (
            <div key={f.t} className="rounded-lg border border-border bg-card p-5">
              <f.i className="h-6 w-6 text-accent" />
              <h3 className="mt-3 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
