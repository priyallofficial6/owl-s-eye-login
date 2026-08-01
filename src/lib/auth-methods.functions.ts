import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, magicTokenFor } from "@/lib/auth-methods.server";

/**
 * Real server-side backing for the alternative login methods on /login.
 * Every function talks to the project database / Supabase Auth — no mocks.
 */

type SessionTokens = { access_token: string; refresh_token: string };


/* ---------------- Username + password ---------------- */

export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ username: z.string().trim().min(1).max(120), password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<SessionTokens> => {
    const a = await admin();
    const uname = data.username.toLowerCase();
    const { data: row } = await a
      .from("profiles")
      .select("email")
      .ilike("username", uname)
      .maybeSingle();
    const email = row?.email as string | undefined;
    if (!email) throw new Error("No account found for that username.");

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
    const pub = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error } = await pub.auth.signInWithPassword({ email, password: data.password });
    if (error || !signIn.session) throw new Error(error?.message ?? "Invalid username or password.");
    return {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });

/* ---------------- License key ---------------- */

export const signInWithLicenseKey = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ licenseKey: z.string().trim().min(6).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ token_hash: string; email: string }> => {
    const a = await admin();
    const { data: row } = await a
      .from("license_keys")
      .select("id, email, user_id, status, expires_at")
      .eq("license_key", data.licenseKey.trim().toUpperCase())
      .maybeSingle();

    if (!row) throw new Error("That license key was not recognised.");
    if (row.status !== "active") throw new Error(`This license is ${row.status}.`);
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("This license has expired.");
    }

    let email: string | null = row.email ?? null;
    if (!email && row.user_id) {
      const { data: prof } = await a.from("profiles").select("email").eq("id", row.user_id).maybeSingle();
      email = prof?.email ?? null;
    }
    if (!email) throw new Error("This license is not linked to an account yet.");

    const token_hash = await magicTokenFor(email);
    await a.from("license_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
    return { token_hash, email };
  });

/* ---------------- QR sign-in ---------------- */

export const createQrSession = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ token: string; expiresAt: string }> => {
    const a = await admin();
    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const { error } = await a
      .from("auth_qr_sessions")
      .insert({ token, status: "pending", expires_at: expiresAt });
    if (error) throw new Error(error.message);
    return { token, expiresAt };
  },
);

export const pollQrSession = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(64) }).parse(input))
  .handler(async ({ data }): Promise<{ status: string; token_hash?: string }> => {
    const a = await admin();
    const { data: row } = await a
      .from("auth_qr_sessions")
      .select("id, status, approved_email, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { status: "expired" };
    if (new Date(row.expires_at).getTime() < Date.now()) return { status: "expired" };
    if (row.status !== "approved" || !row.approved_email) return { status: row.status };

    const token_hash = await magicTokenFor(row.approved_email);
    await a.from("auth_qr_sessions").update({ status: "consumed" }).eq("id", row.id);
    return { status: "approved", token_hash };
  });

export const approveQrSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(8).max(64) }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const a = await admin();
    const { data: row } = await a
      .from("auth_qr_sessions")
      .select("id, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("This sign-in request no longer exists.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("This sign-in request has expired.");
    if (row.status !== "pending") throw new Error("This sign-in request was already handled.");

    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    if (!email) throw new Error("Your session has no email address.");

    const { error } = await a
      .from("auth_qr_sessions")
      .update({ status: "approved", approved_email: email, user_id: context.userId })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
