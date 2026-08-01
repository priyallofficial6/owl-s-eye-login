/**
 * Role keys used across the workspace. These mirror the `app_role` enum in the
 * database (see the auth migration) — keep both in sync.
 */
export const ROLE_KEYS = [
  "founder",
  "boss",
  "admin",
  "franchise",
  "vendor",
  "reseller",
  "developer",
  "finance",
  "sales",
  "marketing",
  "support",
  "employee",
  "author",
  "seo",
  "influencer",
  "affiliate",
  "customer",
  "marketplace-user",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === "string" && (ROLE_KEYS as readonly string[]).includes(value);
}

export function roleLabel(role: RoleKey): string {
  return role
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
