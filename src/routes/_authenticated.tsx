import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Target, Users, Shield, FileSearch, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, role, loading, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar role={role} signOut={signOut} email={user.email ?? ""} />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <span className="text-xs rounded-full bg-secondary px-2 py-1 text-secondary-foreground capitalize">{role ?? "loading"}</span>
          </header>
          <main className="flex-1 bg-background p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ role, signOut, email }: { role: string | null; signOut: () => Promise<void>; email: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();

  const items = [
    { url: "/dashboard", title: "Dashboard", icon: LayoutDashboard, roles: ["employee", "manager", "admin"] },
    { url: "/goals", title: "My Goals", icon: Target, roles: ["employee", "manager", "admin"] },
    { url: "/team", title: "Team", icon: Users, roles: ["manager", "admin"] },
    { url: "/admin", title: "Admin", icon: Shield, roles: ["admin"] },
    { url: "/audit", title: "Audit Log", icon: FileSearch, roles: ["admin"] },
  ];

  const visible = items.filter((i) => role && i.roles.includes(role));
  const isActive = (u: string) => path === u || path.startsWith(u + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">U</div>
          <div className="text-sm font-semibold tracking-tight text-sidebar-foreground">UberHoles</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <Link to={it.url} className="flex items-center gap-2">
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2 text-xs text-sidebar-foreground/70 truncate">{email}</div>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={async () => { await signOut(); nav({ to: "/login" }); }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
