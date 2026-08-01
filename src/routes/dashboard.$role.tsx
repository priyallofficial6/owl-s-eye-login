import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuthenticatedRole, signOut } from "@/lib/auth-bridge";
import { isRoleKey, roleLabel, type RoleKey } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/$role")({
  head: ({ params }) => {
    const label = isRoleKey(params.role) ? roleLabel(params.role) : "Workspace";
    return {
      meta: [
        { title: `${label} Workspace · Software Vala Nexus OS` },
        {
          name: "description",
          content: `Signed-in ${label.toLowerCase()} workspace for Software Vala Nexus OS with live account and role data.`,
        },
        { property: "og:title", content: `${label} Workspace · Nexus OS` },
        {
          property: "og:description",
          content: `Signed-in ${label.toLowerCase()} workspace for Software Vala Nexus OS.`,
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: DashboardPage,
});

type Profile = { full_name: string | null; username: string | null; email: string | null };

function DashboardPage() {
  const { role } = Route.useParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleKey | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await getAuthenticatedRole();
      if (cancelled) return;
      if (!resolved) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setActiveRole(resolved);

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        const [{ data: prof }, { data: roleRows }] = await Promise.all([
          supabase.from("profiles").select("full_name, username, email").eq("id", uid).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ]);
        if (cancelled) return;
        setProfile((prof as Profile) ?? null);
        setRoles((roleRows ?? []).map((r) => String(r.role)));
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, role]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </main>
    );
  }

  const label = isRoleKey(role) ? roleLabel(role) : roleLabel(activeRole ?? "author");

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Nexus OS</p>
          <h1 className="text-3xl font-semibold tracking-tight">{label} Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {profile?.full_name || profile?.username || profile?.email || "your account"}.
          </p>
        </header>

        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-medium">Account</h2>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-4">
              <dt>Email</dt>
              <dd className="text-foreground">{profile?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Username</dt>
              <dd className="text-foreground">{profile?.username ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Granted roles</dt>
              <dd className="text-foreground">{roles.length ? roles.join(", ") : "author"}</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/chat"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Internal chat
          </Link>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
