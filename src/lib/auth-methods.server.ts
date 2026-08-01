/**
 * Server-only helpers for the alternative sign-in methods.
 * Kept out of the *.functions.ts wrapper so server-fn splitting can't strip them.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

/** Creates a one-time sign-in token hash for an existing account. */
export async function magicTokenFor(email: string): Promise<string> {
  const a = await admin();
  const { data, error } = await a.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const hashed = data?.properties?.hashed_token;
  if (!hashed) throw new Error("Could not create a sign-in token for this account.");
  return hashed as string;
}
