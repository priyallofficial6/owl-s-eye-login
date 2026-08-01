import type { RoleKey } from "@/lib/roles";
import { isRoleKey } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";

/**
 * Real auth bridge — Supabase session + `user_roles` table.
 *
 * Route guards call `getAuthenticatedRole()`. It returns:
 *   - a RoleKey when the user is signed in (highest-privilege role from
 *     user_roles, or a client-side override set at sign-in time)
 *   - null when there is no Supabase session (guards redirect to /login)
 */

export const EXISTING_LOGIN_URL = "/login";

// Priority: admin (boss) beats all specific roles.
const ROLE_PRIORITY: RoleKey[] = [
  "founder", "boss", "admin",
  "franchise", "vendor", "reseller",
  "developer", "finance", "sales", "marketing", "support", "employee",
  "author", "seo", "influencer", "affiliate",
  "customer", "marketplace-user",
];

const OVERRIDE_KEY = "sv_active_role";

function readOverride(): RoleKey | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(OVERRIDE_KEY);
  return isRoleKey(stored) ? stored : null;
}

export async function getAuthenticatedRole(): Promise<RoleKey | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  // Prefer the role selected on the login page for this session.
  const override = readOverride();

  const { data: rows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const dbRoles = new Set((rows ?? []).map((r) => String(r.role)));

  // Honour override only if the user actually holds that role, or if they're
  // admin (admins can preview any workspace).
  if (override && (dbRoles.has(override) || dbRoles.has("admin"))) {
    return override;
  }

  for (const r of ROLE_PRIORITY) {
    if (dbRoles.has(r)) return r;
  }

  // Signed in but no role row yet — treat as author (baseline workspace).
  return override ?? "author";
}

export async function signOut(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(OVERRIDE_KEY);
  }
  await supabase.auth.signOut();
}

/** Persist the role the user chose on the login page (used post-signin). */
export function devSetRole(role: RoleKey) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OVERRIDE_KEY, role);
  }
}
