import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { getAuthenticatedRole } from "@/lib/auth-bridge";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Mail, User, Phone, KeyRound, QrCode, ShieldCheck, Fingerprint, Eye, EyeOff,
  Lock, Globe, Mic, MicOff, MessageSquare, Sparkles, ChevronRight, Building2,
  Code2, Bot, BarChart3, Search, Briefcase, LifeBuoy, Radio, Wifi, Server,
  CheckCircle2, AlertTriangle, Languages, ArrowRight, Crown, RefreshCcw,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  createQrSession, pollQrSession, signInWithLicenseKey, signInWithUsername,
} from "@/lib/auth-methods.functions";
import { toast } from "sonner";
import aiConciergeUrl from "@/assets/ai-concierge-vala.jpg";
import checkerBgAsset from "@/assets/softwarevala-checker-bg.jpg.asset.json";

const loginSearchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s) => loginSearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Software Vala — Nexus OS Login" },
      { name: "description", content: "Secure access to the Software Vala Nexus OS — the operating system of a global software ecosystem." },
      { property: "og:title", content: "Software Vala — Nexus OS Login" },
      { property: "og:description", content: "Enter the Software Vala Universe." },
    ],
  }),
  component: NexusLogin,
});

/* ============================ Data ============================ */

const OPPORTUNITIES = [
  { role: "Senior Developer", team: "Platform Core", level: "L5", icon: Code2, grad: "var(--grad-violet)" },
  { role: "AI Engineer", team: "Nexus Intelligence", level: "L5", icon: Bot, grad: "var(--grad-cyan)" },
  { role: "Data Scientist", team: "Insights Lab", level: "L4", icon: BarChart3, grad: "var(--grad-teal)" },
  { role: "SEO Expert", team: "Growth", level: "L4", icon: Search, grad: "var(--grad-amber)" },
  { role: "Sales Executive", team: "Enterprise GTM", level: "L3", icon: Briefcase, grad: "var(--grad-emerald)" },
  { role: "Support Executive", team: "Global Care", level: "L2", icon: LifeBuoy, grad: "var(--grad-rose)" },
] as const;

const PROGRAMS = [
  { tag: "Featured", title: "Founder Fellowship 2026", desc: "120 seats · Global cohort" },
  { tag: "Live Hiring", title: "Nexus AI Residency", desc: "Apply by Jun 28" },
  { tag: "Announcement", title: "v4.2 ships worldwide tonight", desc: "Multi-region rollout" },
] as const;

const METHODS = [
  { id: "email", label: "Email", icon: Mail },
  { id: "username", label: "Username", icon: User },
  { id: "mobile", label: "Mobile", icon: Phone },
  { id: "license", label: "License Key", icon: KeyRound },
  { id: "otp", label: "OTP", icon: Radio },
  { id: "qr", label: "QR", icon: QrCode },
  { id: "sso", label: "SSO", icon: Building2 },
] as const;

type MethodId = (typeof METHODS)[number]["id"];

type AIState =
  | "idle" | "greeting" | "typingUser" | "typingPass" | "wrongPass" | "success"
  | "otp" | "qr" | "license" | "locked" | "reset" | "maintenance" | "serverError"
  | "vip" | "first" | "securityAlert" | "multiDevice";

const AI_LINES: Record<AIState, { mood: string; line: string; tone: string }> = {
  idle:          { mood: "Standing by", line: "I'm here whenever you're ready, boss.", tone: "calm" },
  greeting:      { mood: "Welcoming",   line: "Welcome back. Nexus OS is warm and waiting.", tone: "warm" },
  typingUser:    { mood: "Attentive",   line: "Identifying your profile across 1M+ accounts…", tone: "focused" },
  typingPass:    { mood: "Discreet",    line: "Your keystrokes are encrypted end-to-end.", tone: "secure" },
  wrongPass:     { mood: "Concerned",   line: "That credential didn't match. Two attempts remain.", tone: "alert" },
  success:       { mood: "Delighted",   line: "Authenticated. Opening your command surface.", tone: "celebration" },
  otp:           { mood: "Verifying",   line: "I've dispatched a one-time code to your trusted device.", tone: "secure" },
  qr:            { mood: "Scanning",    line: "Hold your Nexus companion app over the code.", tone: "focused" },
  license:       { mood: "Validating",  line: "Cross-checking your enterprise license with HQ.", tone: "secure" },
  locked:        { mood: "Protective",  line: "Account is temporarily sealed. I'll guide recovery.", tone: "alert" },
  reset:         { mood: "Reassuring",  line: "Let's get you a fresh credential, securely.", tone: "warm" },
  maintenance:   { mood: "Informing",   line: "We're upgrading EU region. Read-only for ~6 minutes.", tone: "neutral" },
  serverError:   { mood: "Apologetic",  line: "A node hiccupped. Failover engaged — try again.", tone: "alert" },
  vip:           { mood: "Honored",     line: "Boss-tier access detected. White-glove session opened.", tone: "celebration" },
  first:         { mood: "Curious",     line: "First time here? I'll personally walk you through.", tone: "warm" },
  securityAlert: { mood: "Vigilant",    line: "New geo signature flagged. Confirm it's you.", tone: "alert" },
  multiDevice:   { mood: "Noting",      line: "3 active sessions detected. Want to review them?", tone: "neutral" },
};

const ECOSYSTEM_NODES = [
  { id: "marketplace", label: "Marketplace", x: 18, y: 22 },
  { id: "reseller",    label: "Reseller",    x: 32, y: 70 },
  { id: "franchise",   label: "Franchise",   x: 12, y: 82 },
  { id: "support",     label: "Support",     x: 78, y: 28 },
  { id: "ai",          label: "AI",          x: 88, y: 58 },
  { id: "security",    label: "Security",    x: 70, y: 88 },
  { id: "licensing",   label: "Licensing",   x: 50, y: 12 },
  { id: "servers",     label: "Servers",     x: 6,  y: 48 },
  { id: "apps",        label: "Apps",        x: 60, y: 50 },
  { id: "products",    label: "Products",    x: 40, y: 38 },
  { id: "users",       label: "Users",       x: 50, y: 90 },
];

/* ============================ Page ============================ */

function NexusLogin() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/login" });
  const [method, setMethod] = useState<MethodId>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [stage, setStage] = useState<AIState>("greeting");
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [voice, setVoice] = useState(false);
  const [lang, setLang] = useState("EN");
  const [clock, setClock] = useState(() => new Date());
  const [otpSent, setOtpSent] = useState(false);
  const [ssoDomain, setSsoDomain] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setStage("idle"), 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reset per-method transient state when switching methods.
  useEffect(() => {
    setOtpSent(false);
    setPassword("");
  }, [method]);

  // If already signed in, jump straight to the intended workspace.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      void routeAfterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onIdentifierFocus = () => setStage("typingUser");
  const onPasswordFocus = () => setStage("typingPass");
  const onBlur = () => setStage((s) => (s === "typingUser" || s === "typingPass" ? "idle" : s));

  // Destination is derived from the signed-in user's real role (user_roles).
  const routeAfterAuth = async () => {
    if (next && next.startsWith("/")) {
      window.location.replace(next);
      return;
    }
    const role = (await getAuthenticatedRole()) ?? "author";
    navigate({ to: "/dashboard/$role", params: { role }, replace: true });
  };

  const finishAuth = () => {
    setStage("success");
    setTimeout(() => void routeAfterAuth(), 400);
  };

  const fail = (msg: string) => {
    setAttempts((a) => a + 1);
    setStage("wrongPass");
    toast.error(msg);
    setSubmitting(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const id = identifier.trim();

      if (method === "email") {
        if (!id || !password) return fail("Enter your email and password.");
        const { error } = await supabase.auth.signInWithPassword({ email: id, password });
        if (error) return fail(error.message);
        return finishAuth();
      }

      if (method === "username") {
        if (!id || !password) return fail("Enter your username and password.");
        const tokens = await signInWithUsername({ data: { username: id, password } });
        const { error } = await supabase.auth.setSession(tokens);
        if (error) return fail(error.message);
        return finishAuth();
      }

      if (method === "mobile" || method === "otp") {
        const isPhone = method === "mobile" || /^\+?[0-9\s-]{7,}$/.test(id);
        if (!id) return fail(isPhone ? "Enter your mobile number." : "Enter your email or mobile number.");

        if (!otpSent) {
          setStage("otp");
          const { error } = isPhone
            ? await supabase.auth.signInWithOtp({ phone: id.replace(/\s/g, "") })
            : await supabase.auth.signInWithOtp({ email: id, options: { shouldCreateUser: false } });
          if (error) return fail(error.message);
          setOtpSent(true);
          setSubmitting(false);
          toast.success(`Verification code sent to ${id}.`);
          return;
        }

        if (!password.trim()) return fail("Enter the code you received.");
        const { error } = isPhone
          ? await supabase.auth.verifyOtp({ phone: id.replace(/\s/g, ""), token: password.trim(), type: "sms" })
          : await supabase.auth.verifyOtp({ email: id, token: password.trim(), type: "email" });
        if (error) return fail(error.message);
        return finishAuth();
      }

      if (method === "license") {
        const key = password.trim() || id;
        if (!key) return fail("Enter your license key.");
        setStage("license");
        const { token_hash } = await signInWithLicenseKey({ data: { licenseKey: key } });
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
        if (error) return fail(error.message);
        return finishAuth();
      }

      if (method === "sso") {
        const domain = ssoDomain.trim();
        if (!domain) return fail("Enter your organization domain.");
        const { data, error } = await supabase.auth.signInWithSSO({ domain });
        if (error) return fail(error.message);
        if (data?.url) window.location.assign(data.url);
        return;
      }

      setSubmitting(false);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Sign in failed");
    }
  };

  const onOAuth = async (provider: "google" | "apple" | "microsoft") => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/login",
      });
      if (res.error) throw res.error;
      if (!("redirected" in res && res.redirected)) finishAuth();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${provider} sign-in failed`);
      setSubmitting(false);
    }
  };

  const ai = AI_LINES[stage];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[oklch(0.10_0.02_265)] text-[oklch(0.96_0.01_260)]">
      <NexusBackground />

      {/* Top strip — security telemetry */}
      <div className="relative z-20 mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 pt-5 [animation:nx-fade-down_700ms_ease-out_both]">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/60">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-md">
            <span className="relative size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400/80">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
            </span>
            Nexus OS · Operational
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-md">
            <Server className="size-3" /> 42 regions
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-md">
            <ShieldCheck className="size-3" /> 2FA active
          </span>
          <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-md">
            <Wifi className="size-3" /> Trusted device
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/70">
          <button
            onClick={() => setLang((l) => (l === "EN" ? "हिं" : l === "हिं" ? "العربية" : "EN"))}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-md transition-all hover:bg-white/[0.12] hover:ring-white/20"
          >
            <Languages className="size-3" /> {lang}
          </button>
          <span className="hidden sm:inline tabular-nums text-white/50">
            {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Main grid */}
      <div className="relative z-10 mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)_360px] xl:gap-8">
        <div className="[animation:nx-fade-up_900ms_120ms_cubic-bezier(.2,.7,.2,1)_both]">
          <LeftPanel />
        </div>
        <div className="[animation:nx-fade-up_900ms_220ms_cubic-bezier(.2,.7,.2,1)_both]">
          <CenterPanel
            method={method} setMethod={setMethod}
            identifier={identifier} setIdentifier={setIdentifier}
            password={password} setPassword={setPassword}
            showPw={showPw} setShowPw={setShowPw}
            remember={remember} setRemember={setRemember}
            submitting={submitting} attempts={attempts}
            onIdentifierFocus={onIdentifierFocus}
            onPasswordFocus={onPasswordFocus}
            onBlur={onBlur}
            onSubmit={submit}
            onOAuth={onOAuth}
            otpSent={otpSent}
            ssoDomain={ssoDomain} setSsoDomain={setSsoDomain}
            onQrAuthenticated={finishAuth}
            stage={stage}
          />
        </div>
        <div className="[animation:nx-fade-up_900ms_340ms_cubic-bezier(.2,.7,.2,1)_both]">
          <RightPanel ai={ai} stage={stage} voice={voice} setVoice={setVoice} setStage={setStage} />
        </div>
      </div>



      <footer className="relative z-10 mx-auto max-w-[1600px] px-6 pb-6 pt-2 text-center text-[11px] text-white/40">
        Software Vala Nexus OS · A global enterprise operating system · 12,000+ products · 1,000,000+ operators
        <span className="mx-2 text-white/25">·</span>
        <Link to="/chat" className="text-white/60 hover:text-white/90 underline underline-offset-2">Internal Chat</Link>
      </footer>


      <style>{`
        @keyframes nx-fade-up { from { opacity: 0; transform: translateY(14px); filter: blur(6px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes nx-fade-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes nx-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
        @keyframes nx-aurora { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(2%,-1%,0) scale(1.05); } }
      `}</style>
    </div>
  );
}

/* ============================ Background ============================ */

function NexusBackground() {
  const links = useMemo(() => {
    const out: { a: number; b: number }[] = [];
    for (let i = 0; i < ECOSYSTEM_NODES.length; i++) {
      for (let j = i + 1; j < ECOSYSTEM_NODES.length; j++) {
        const dx = ECOSYSTEM_NODES[i]!.x - ECOSYSTEM_NODES[j]!.x;
        const dy = ECOSYSTEM_NODES[i]!.y - ECOSYSTEM_NODES[j]!.y;
        if (Math.hypot(dx, dy) < 38) out.push({ a: i, b: j });
      }
    }
    return out;
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base gradients */}
      <div className="absolute inset-0" style={{
        background:
          "radial-gradient(80% 60% at 20% 10%, oklch(0.32 0.18 280 / 0.55), transparent 60%)," +
          "radial-gradient(70% 60% at 90% 20%, oklch(0.32 0.16 220 / 0.5), transparent 60%)," +
          "radial-gradient(70% 80% at 70% 100%, oklch(0.28 0.18 320 / 0.45), transparent 60%)," +
          "linear-gradient(180deg, oklch(0.12 0.02 265), oklch(0.10 0.02 265))",
      }} />
      {/* subtle grid */}
      <div className="absolute inset-0 opacity-[0.08]" style={{
        backgroundImage:
          "linear-gradient(oklch(1 0 0 / 0.6) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.6) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(80% 60% at 50% 40%, #000, transparent 75%)",
      }} />
      {/* ecosystem nodes */}
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="nx-line" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.18 260)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.82 0.18 320)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {links.map((l, i) => {
          const a = ECOSYSTEM_NODES[l.a]!, b = ECOSYSTEM_NODES[l.b]!;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="url(#nx-line)" strokeWidth="0.08" vectorEffect="non-scaling-stroke" />
          );
        })}
        {ECOSYSTEM_NODES.map((n, i) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="0.9" fill="oklch(0.85 0.18 270)" opacity="0.85">
              <animate attributeName="r" values="0.7;1.2;0.7" dur={`${4 + (i % 5)}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;1;0.4" dur={`${4 + (i % 5)}s`} repeatCount="indefinite" />
            </circle>
            <circle cx={n.x} cy={n.y} r="2.4" fill="oklch(0.85 0.18 270)" opacity="0.10" />
          </g>
        ))}
      </svg>
      {/* drifting aurora orbs */}
      <div className="absolute -left-24 top-1/3 size-[460px] rounded-full blur-3xl [animation:nx-aurora_18s_ease-in-out_infinite]" style={{ background: "radial-gradient(circle, oklch(0.7 0.22 285 / 0.42), transparent 70%)" }} />
      <div className="absolute -right-24 bottom-0 size-[520px] rounded-full blur-3xl [animation:nx-aurora_22s_ease-in-out_infinite_reverse]" style={{ background: "radial-gradient(circle, oklch(0.72 0.2 205 / 0.34), transparent 70%)" }} />
      <div className="absolute left-1/2 top-0 size-[380px] -translate-x-1/2 rounded-full blur-3xl [animation:nx-aurora_26s_ease-in-out_infinite]" style={{ background: "radial-gradient(circle, oklch(0.7 0.2 320 / 0.28), transparent 70%)" }} />
      {/* film grain */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/></svg>\")",
      }} />
      {/* Checkered brand pattern removed from global bg — now only behind AI concierge */}
      {/* vignette */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(120% 80% at 50% 50%, transparent 50%, oklch(0 0 0 / 0.6) 100%)",
      }} />
    </div>
  );
}

/* ============================ Left Panel ============================ */

function LeftPanel() {
  return (
    <aside className="hidden lg:flex flex-col gap-4">
      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Ecosystem · Opportunities</p>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30">
            Live hiring
          </span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {OPPORTUNITIES.map((o) => (
            <li key={o.role} className="group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/[0.04] transition-colors">
              <span className="grid size-9 place-items-center rounded-lg ring-1 ring-white/10" style={{ background: o.grad }}>
                <o.icon className="size-4 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white/90">{o.role}</p>
                <p className="truncate text-[11px] text-white/50">{o.team} · {o.level}</p>
              </div>
              <ChevronRight className="size-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" />
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard className="p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Featured programs</p>
        <ul className="mt-3 space-y-2.5">
          {PROGRAMS.map((p) => (
            <li key={p.title} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-400/30">
                  {p.tag}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-medium text-white/90">{p.title}</p>
              <p className="text-[11px] text-white/55">{p.desc}</p>
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard className="p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Global pulse</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { v: "42", k: "Regions" },
            { v: "1M+", k: "Operators" },
            { v: "12K+", k: "Products" },
          ].map((m) => (
            <div key={m.k} className="rounded-lg bg-white/[0.03] py-2 ring-1 ring-white/10">
              <p className="text-base font-semibold tracking-tight text-white">{m.v}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/50">{m.k}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </aside>
  );
}

/* ============================ Center Panel ============================ */

function CenterPanel(props: {
  method: MethodId; setMethod: (m: MethodId) => void;
  identifier: string; setIdentifier: (s: string) => void;
  password: string; setPassword: (s: string) => void;
  showPw: boolean; setShowPw: (b: boolean) => void;
  remember: boolean; setRemember: (b: boolean) => void;
  submitting: boolean; attempts: number;
  onIdentifierFocus: () => void; onPasswordFocus: () => void; onBlur: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onOAuth: (p: "google" | "apple" | "microsoft") => void;
  otpSent: boolean;
  ssoDomain: string; setSsoDomain: (s: string) => void;
  onQrAuthenticated: () => void;
  stage: AIState;
}) {
  const {
    method, setMethod, identifier, setIdentifier, password, setPassword,
    showPw, setShowPw, remember, setRemember, submitting, attempts,
    onIdentifierFocus, onPasswordFocus, onBlur, onSubmit, onOAuth, stage,
    otpSent, ssoDomain, setSsoDomain, onQrAuthenticated,
  } = props;

  const methodMeta = METHODS.find((m) => m.id === method)!;

  return (
    <section className="flex min-w-0 flex-col items-center justify-start">
      <GlassCard className="relative w-full max-w-[540px] overflow-hidden p-0">
        {/* Ambient corner glows */}
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, oklch(0.7 0.22 285 / 0.35), transparent 70%)" }} />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, oklch(0.7 0.2 205 / 0.28), transparent 70%)" }} />

        {/* Brand header — hero logo treatment */}
        <div className="relative px-7 pt-7">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo variant="round" size={52} />
              <div className="flex flex-col">
                <BrandLogo variant="long" size={32} />
                <span className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/45">Nexus OS · v4.2</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400/15 to-amber-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200 ring-1 ring-amber-300/30 backdrop-blur-md">
              <Crown className="size-3 text-amber-300" /> Founder
            </span>
          </div>
          <div className="mt-7">
            <h1 className="text-[28px] font-semibold leading-[1.1] tracking-tight text-white">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">Boss</span>
            </h1>
            <p className="mt-1.5 text-[13px] text-white/55">
              Sign in to enter the Software Vala universe.
            </p>
          </div>
        </div>

        {/* Method chips */}
        <div className="mt-5 px-7">
          <div className="flex flex-wrap gap-1.5">
            {METHODS.map((m) => {
              const active = m.id === method;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={[
                    "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-300",
                    active
                      ? "text-white shadow-[0_10px_30px_-10px_oklch(0.6_0.22_285/0.8)] ring-1 ring-white/20"
                      : "bg-white/[0.04] text-white/70 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white/90",
                  ].join(" ")}
                  style={active ? { background: "linear-gradient(135deg, oklch(0.5 0.22 290), oklch(0.55 0.2 240))" } : undefined}
                >
                  <m.icon className="size-3.5" /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="mt-5 space-y-3 px-7 pb-2">
          {method === "qr" ? (
            <QRPanel onAuthenticated={onQrAuthenticated} />
          ) : method === "sso" ? (
            <SSOPanel value={ssoDomain} onChange={setSsoDomain} submitting={submitting} />
          ) : (
            <>
              {method !== "license" && (
                <Field
                  icon={methodMeta.icon}
                  label={methodLabel(method)}
                  placeholder={methodPlaceholder(method)}
                  value={identifier}
                  onChange={setIdentifier}
                  onFocus={onIdentifierFocus}
                  onBlur={onBlur}
                  type={method === "mobile" ? "tel" : method === "email" ? "email" : "text"}
                  autoComplete={method === "email" ? "email" : method === "mobile" ? "tel" : "username"}
                />
              )}
              {(method === "email" || method === "username") && (
                <Field
                  icon={Lock}
                  label="Password"
                  placeholder="Enter your secure password"
                  value={password}
                  onChange={setPassword}
                  onFocus={onPasswordFocus}
                  onBlur={onBlur}
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  trailing={
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="grid size-7 place-items-center rounded-md text-white/50 hover:text-white">
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
              )}
              {method === "license" && (
                <Field
                  icon={KeyRound}
                  label="License key"
                  placeholder="NEXUS-XXXX-XXXX-XXXX"
                  value={password}
                  onChange={setPassword}
                  onFocus={onPasswordFocus}
                  onBlur={onBlur}
                  type="text"
                  monospace
                />
              )}
              {(method === "otp" || method === "mobile") && otpSent && (
                <Field
                  icon={Radio}
                  label="One-time code"
                  placeholder="6-digit secure code"
                  value={password}
                  onChange={setPassword}
                  onFocus={onPasswordFocus}
                  onBlur={onBlur}
                  type="text"
                  autoComplete="one-time-code"
                  monospace
                />
              )}


              {attempts > 0 && stage === "wrongPass" && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200 ring-1 ring-rose-400/30">
                  <AlertTriangle className="size-3.5" />
                  Credential mismatch. {Math.max(0, 3 - attempts)} attempt(s) remaining.
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[12px] text-white/65">
                  <span className={[
                    "relative inline-flex h-[18px] w-[32px] items-center rounded-full transition-colors",
                    remember ? "bg-violet-500/80" : "bg-white/10",
                  ].join(" ")} onClick={() => setRemember(!remember)}>
                    <span className={[
                      "absolute top-[2px] size-[14px] rounded-full bg-white transition-all",
                      remember ? "left-[16px]" : "left-[2px]",
                    ].join(" ")} />
                  </span>
                  Remember this device
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const email = window.prompt("Enter your account email to receive a reset link:", identifier || "");
                    if (!email) return;
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: window.location.origin + "/login",
                    });
                    if (error) toast.error(error.message);
                    else toast.success("Reset link sent — check your inbox.");
                  }}
                  className="text-[12px] font-medium text-violet-300 hover:text-violet-200"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="group relative mt-2 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3.5 text-[14px] font-semibold text-white shadow-[0_20px_50px_-16px_oklch(0.55_0.22_280/0.8),inset_0_1px_0_oklch(1_0_0/0.22)] transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_28px_60px_-18px_oklch(0.6_0.22_280/0.9),inset_0_1px_0_oklch(1_0_0/0.3)] active:translate-y-0 disabled:opacity-70"
                style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 285), oklch(0.58 0.2 240))" }}
              >
                {/* hover gradient swap */}
                <span className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "linear-gradient(135deg, oklch(0.62 0.23 285), oklch(0.66 0.21 240))" }} />
                {/* shimmer sweep */}
                <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 group-hover:opacity-100 [animation:nx-shimmer_1.8s_ease-in-out_infinite]" />
                <span className="relative z-10 inline-flex items-center gap-2">
                  {submitting ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Verifying securely…
                    </>
                  ) : stage === "success" ? (
                    <>
                      <CheckCircle2 className="size-4" /> Authenticated · Opening Nexus OS
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      Secure sign-in
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </span>
              </button>
            </>
          )}
        </form>

        {/* Divider */}
        <div className="px-7 pt-4">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
            <span className="h-px flex-1 bg-white/10" />
            or continue with
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </div>

        {/* Enterprise providers */}
        <div className="grid grid-cols-2 gap-2 px-7 pt-3 sm:grid-cols-4">
          {([
            { label: "Google", letter: "G", provider: "google" },
            { label: "Microsoft", letter: "M", provider: "microsoft" },
            { label: "Apple", letter: "", provider: "apple" },
            { label: "Enterprise", letter: "E", provider: null },
          ] as const).map((p) => (
            <button key={p.label} type="button"
              onClick={() => (p.provider ? onOAuth(p.provider) : setMethod("sso"))}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-[12px] font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/[0.08] disabled:opacity-50">
              <span className="grid size-5 place-items-center rounded-md bg-white/10 text-[11px] font-bold">{p.letter || "⌥"}</span>
              {p.label}
            </button>
          ))}
        </div>


        {/* Security strip */}
        <div className="mt-6 grid grid-cols-3 gap-px bg-white/10 px-px pb-px">
          {[
            { icon: ShieldCheck, k: "Security", v: "Healthy" },
            { icon: Fingerprint, k: "Last sign-in", v: "Just now · this device" },
            { icon: Globe, k: "Region", v: "Auto-routed · EU-W" },
          ].map((s) => (
            <div key={s.k} className="bg-[oklch(0.14_0.02_265)] px-4 py-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/45">
                <s.icon className="size-3" /> {s.k}
              </div>
              <p className="mt-0.5 truncate text-[12px] font-medium text-white/85">{s.v}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}

function methodLabel(m: MethodId) {
  return ({
    email: "Work email", username: "Username", mobile: "Mobile number",
    license: "License key", otp: "Identifier",
    qr: "QR", sso: "SSO",
  } as Record<MethodId, string>)[m];
}
function methodPlaceholder(m: MethodId) {
  return ({
    email: "founder@softwarevala.com",
    username: "founder-handle",
    mobile: "+91 98xxx xxxxx",
    license: "NEXUS-XXXX-XXXX-XXXX",
    otp: "Email or mobile to receive code",
    qr: "", sso: "",
  } as Record<MethodId, string>)[m];
}

function Field(props: {
  icon: typeof Mail; label: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  onFocus?: () => void; onBlur?: () => void;
  type?: string; autoComplete?: string; monospace?: boolean;
  trailing?: React.ReactNode;
}) {
  const { icon: Icon, label, placeholder, value, onChange, onFocus, onBlur, type = "text", autoComplete, monospace, trailing } = props;
  const [focused, setFocused] = useState(false);
  return (
    <label className={[
      "group block rounded-xl bg-white/[0.04] px-3.5 py-2.5 ring-1 transition-all",
      focused ? "ring-violet-400/60 bg-white/[0.06] shadow-[0_0_0_4px_oklch(0.7_0.2_280/0.12)]" : "ring-white/10",
    ].join(" ")}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className="mt-0.5 flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-white/55" />
        <input
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { setFocused(true); onFocus?.(); }}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          placeholder={placeholder}
          className={[
            "min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none",
            monospace ? "font-mono tracking-widest" : "",
          ].join(" ")}
        />
        {trailing}
      </div>
    </label>
  );
}

function QRPanel({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "pending" | "expired" | "error">("loading");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        setStatus("loading");
        setDataUrl(null);
        const { token } = await createQrSession({});
        if (cancelled) return;
        const QR = (await import("qrcode")).default;
        const url = `${window.location.origin}/qr-approve/${token}`;
        const img = await QR.toDataURL(url, { width: 320, margin: 1, color: { dark: "#141a2e", light: "#ffffff" } });
        if (cancelled) return;
        setDataUrl(img);
        setStatus("pending");

        poll = setInterval(async () => {
          try {
            const res = await pollQrSession({ data: { token } });
            if (cancelled) return;
            if (res.status === "approved" && res.token_hash) {
              clearInterval(poll);
              const { error } = await supabase.auth.verifyOtp({ token_hash: res.token_hash, type: "magiclink" });
              if (error) { toast.error(error.message); setStatus("error"); return; }
              onAuthenticated();
            } else if (res.status === "expired") {
              clearInterval(poll);
              setStatus("expired");
            }
          } catch { /* keep polling */ }
        }, 2500);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        toast.error(err instanceof Error ? err.message : "Could not start QR sign-in.");
      }
    })();

    return () => { cancelled = true; if (poll) clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
      <div className="flex items-center gap-4">
        <div className="relative grid size-32 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-3">
          {dataUrl ? (
            <img src={dataUrl} alt="Sign-in QR code" className="size-full object-contain" />
          ) : (
            <span className="size-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          )}
          {status === "pending" && (
            <span className="pointer-events-none absolute inset-x-0 h-[2px] animate-[nx-scan_2.2s_linear_infinite] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
          )}
        </div>
        <div>
          <p className="text-[13px] font-medium text-white/90">Scan with a signed-in device</p>
          <p className="mt-1 text-[12px] text-white/55">Open the camera · Scan this code · Approve the request. Expires in 5 minutes.</p>
          {status === "pending" && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Waiting for device
            </div>
          )}
          {(status === "expired" || status === "error") && (
            <button type="button" onClick={() => setNonce((n) => n + 1)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white ring-1 ring-white/15 hover:bg-white/15">
              <RefreshCcw className="size-3" /> {status === "expired" ? "Code expired — refresh" : "Retry"}
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes nx-scan { 0% { top: 8% } 50% { top: 92% } 100% { top: 8% } }`}</style>
    </div>
  );
}

function SSOPanel({ value, onChange, submitting }: { value: string; onChange: (s: string) => void; submitting: boolean }) {
  return (
    <div className="space-y-2">
      <Field icon={Building2} label="Organization domain" placeholder="acme.com" value={value} onChange={onChange} />
      <button type="submit" disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-[13px] font-medium text-white ring-1 ring-white/10 hover:bg-white/[0.1] disabled:opacity-60">
        <Building2 className="size-4" /> {submitting ? "Redirecting…" : "Continue with Enterprise SSO"}
      </button>
    </div>
  );
}


/* ============================ Right Panel (AI) ============================ */

function RightPanel({ ai, stage, voice, setVoice, setStage }: {
  ai: { mood: string; line: string; tone: string };
  stage: AIState;
  voice: boolean;
  setVoice: (b: boolean) => void;
  setStage: (s: AIState) => void;
}) {
  // Speak the current AI line aloud when voice is on — human-like concierge.
  useEffect(() => {
    if (!voice) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(ai.line);
      u.rate = 1;
      u.pitch = 1.05;
      u.volume = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /female|zira|samantha|google uk english female/i.test(v.name)) ||
        voices.find((v) => /en-/i.test(v.lang));
      if (preferred) u.voice = preferred;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
    return () => {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    };
  }, [ai.line, voice]);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showHuman, setShowHuman] = useState(false);

  return (
    <aside className="flex flex-col gap-3">
      <GlassCard className="overflow-hidden p-0">
        {/* Tall hero so upper body (face, neck, shoulders, chest, ID) is visible */}
        <div className="relative h-[460px] overflow-hidden">
          <AIAvatar stage={stage} />
        </div>
        <div className="space-y-3 px-5 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">AI Concierge</p>
              <p className="mt-0.5 text-[15px] font-semibold text-white">Vala · {ai.mood}</p>
            </div>
            <button
              onClick={() => setVoice(!voice)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors",
                voice ? "bg-violet-500/20 text-violet-200 ring-violet-400/30" : "bg-white/5 text-white/65 ring-white/10",
              ].join(" ")}
            >
              {voice ? <Mic className="size-3" /> : <MicOff className="size-3" />}
              {voice ? "Listening" : "Voice off"}
            </button>
          </div>

          <div className="relative rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10">
            <div className="absolute -top-1.5 left-5 size-3 rotate-45 bg-white/[0.05] ring-1 ring-white/10" />
            <p className="text-[13px] leading-relaxed text-white/85">{ai.line}</p>
          </div>
        </div>
      </GlassCard>

      {/* Collapsible: Quick help shortcuts */}
      <CollapsibleCard
        label="Quick help"
        open={showShortcuts}
        onToggle={() => setShowShortcuts((v) => !v)}
      >
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "first", label: "First time?" },
            { id: "reset", label: "Reset password" },
            { id: "securityAlert", label: "Security help" },
            { id: "multiDevice", label: "Active sessions" },
          ].map((q) => (
            <button key={q.id} onClick={() => setStage(q.id as AIState)}
              className="inline-flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08]">
              {q.label}
              <Sparkles className="size-3 text-violet-300" />
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {/* Collapsible: Security zone */}
      <CollapsibleCard
        label="Security zone"
        open={showSecurity}
        onToggle={() => setShowSecurity((v) => !v)}
      >
        <ul className="space-y-2 text-[12px]">
          {[
            { k: "System", v: "Operational", ok: true },
            { k: "AI Concierge", v: "Online", ok: true },
            { k: "Server health", v: "99.998%", ok: true },
            { k: "License", v: "Founder · Lifetime", ok: true },
            { k: "Last login", v: "2 hours ago · Mumbai", ok: true },
            { k: "Active sessions", v: "3 devices", ok: false },
          ].map((s) => (
            <li key={s.k} className="flex items-center justify-between">
              <span className="text-white/55">{s.k}</span>
              <span className={["inline-flex items-center gap-1.5", s.ok ? "text-emerald-300" : "text-amber-300"].join(" ")}>
                <span className={["size-1.5 rounded-full", s.ok ? "bg-emerald-400" : "bg-amber-400"].join(" ")} />
                {s.v}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleCard>

      {/* Collapsible: Need a human */}
      <CollapsibleCard
        label="Need a human?"
        open={showHuman}
        onToggle={() => setShowHuman((v) => !v)}
        icon={<MessageSquare className="size-3.5 text-white/75" />}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-white/70">24/7 enterprise concierge · &lt;30s response</p>
          <Link to="/chat" className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.1]">Open</Link>
        </div>
      </CollapsibleCard>
    </aside>
  );
}

function CollapsibleCard({
  label,
  open,
  onToggle,
  icon,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/60">
          {icon}
          {label}
        </span>
        <span className={["text-white/50 transition-transform", open ? "rotate-90" : ""].join(" ")}>›</span>
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </GlassCard>
  );
}

function AIAvatar({ stage }: { stage: AIState }) {
  const accentMap: Partial<Record<AIState, string>> = {
    greeting: "oklch(0.78 0.18 280)",
    success: "oklch(0.78 0.17 150)",
    wrongPass: "oklch(0.72 0.2 25)",
    locked: "oklch(0.72 0.2 25)",
    securityAlert: "oklch(0.78 0.16 60)",
    serverError: "oklch(0.72 0.2 25)",
    vip: "oklch(0.85 0.17 80)",
  };
  const accent = accentMap[stage] ?? "oklch(0.78 0.18 260)";

  // Human-like reaction captions per state (mirrors the reference sheet).
  const reactionMap: Record<AIState, { expression: string; caption: string }> = {
    idle:          { expression: "Smile · Idle breathing",     caption: "Welcome to Software Vala Nexus OS" },
    greeting:      { expression: "Warm welcome",               caption: "Welcome back, boss 👋" },
    typingUser:    { expression: "Attentive · Listening",      caption: "Identifying your profile…" },
    typingPass:    { expression: "Covers eyes · Discreet",     caption: "Your keystrokes stay private 🙈" },
    wrongPass:     { expression: "Concerned · Head shake",     caption: "Oh no! Please verify your credentials." },
    success:       { expression: "Happy · Thumbs up",          caption: "Welcome back, boss 🎉 Login successful." },
    otp:           { expression: "Scanning · Focused",         caption: "OTP dispatched. Waiting for verification…" },
    qr:            { expression: "Scanning · Focused",         caption: "Hold the QR steady — reading now." },
    license:       { expression: "Validating · Secure",        caption: "Cross-checking your enterprise license." },
    locked:        { expression: "Serious · Security mode",    caption: "Account locked temporarily for safety 🔒" },
    reset:         { expression: "Helpful · Supportive",       caption: "Don't worry! I'll help you recover access." },
    maintenance:   { expression: "Informing · Neutral",        caption: "Quick upgrade in progress — read-only mode." },
    serverError:   { expression: "Concerned · Alert mode",     caption: "Our systems are busy. Please try again shortly." },
    vip:           { expression: "Respectful · Hands joined",  caption: "Back boss 🙏 Ready for today's mission." },
    first:         { expression: "Excited · Celebration",      caption: "Welcome to the Software Vala family! 🎉" },
    securityAlert: { expression: "Vigilant · Alert",           caption: "New sign-in signature — confirm it's you." },
    multiDevice:   { expression: "Noting · Neutral",           caption: "3 active sessions — want to review them?" },
  };
  const reaction = reactionMap[stage];

  const active = stage === "typingUser" || stage === "typingPass" || stage === "otp" ||
                 stage === "qr" || stage === "license" || stage === "success" || stage === "greeting";

  return (
    <div className="relative size-full overflow-hidden">
      {/* Software Vala checkered brand backdrop — ONLY behind the concierge */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${checkerBgAsset.url})`,
          backgroundSize: "220px auto",
          backgroundRepeat: "repeat",
          opacity: 0.18,
          maskImage: "radial-gradient(85% 75% at 50% 45%, #000 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(85% 75% at 50% 45%, #000 40%, transparent 85%)",
        }}
      />
      {/* ambient scene grade — marries portrait to UI palette */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.16 0.04 275 / 0.55) 0%, oklch(0.10 0.02 265 / 0.85) 78%, oklch(0.06 0.02 265 / 0.98) 100%)",
        }}
      />
      {/* soft rim light from top corners */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(45% 40% at 22% 12%, oklch(0.85 0.14 285 / 0.28), transparent 70%)," +
            "radial-gradient(35% 30% at 82% 20%, oklch(0.85 0.14 220 / 0.22), transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      {/* dynamic accent halo behind the portrait */}
      <div
        aria-hidden
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: `radial-gradient(55% 50% at 50% 40%, ${accent.replace(")", " / 0.45)")}, transparent 72%)`,
        }}
      />
      {/* Owl concierge — covers its eyes while secrets are typed */}
      <OwlConcierge
        covered={stage === "typingPass"}
        accent={accent}
        alert={stage === "wrongPass" || stage === "locked" || stage === "serverError"}
        celebrate={stage === "success" || stage === "first"}
      />

      {/* floor shadow ellipse — grounds the portrait */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
        style={{
          background:
            "radial-gradient(60% 90% at 50% 100%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.28) 45%, transparent 75%)",
        }}
      />
      {/* Accent inner glow (vignette) */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{
          boxShadow: `inset 0 0 140px ${accent.replace(")", " / 0.22)")}, inset 0 -40px 60px rgba(0,0,0,0.45)`,
        }}
      />
      {/* Status pill (top-right) */}
      <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/85 ring-1 ring-white/15 backdrop-blur-md">
        <span
          className="relative size-1.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
        >
          <span className="absolute inset-0 animate-ping rounded-full" style={{ background: accent, opacity: 0.5 }} />
        </span>
        {active ? "Listening" : "Standing by"}
      </div>
      {/* Reaction caption bubble */}
      <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/55 px-3 py-2 text-[11px] text-white/90 ring-1 ring-white/10 backdrop-blur-md">
        <div className="text-[9px] uppercase tracking-[0.18em] text-white/55">{reaction.expression}</div>
        <div className="mt-0.5 text-[12px] font-medium text-white">{reaction.caption}</div>
      </div>
      {/* voice waveform indicator */}
      <div className="pointer-events-none absolute bottom-16 left-1/2 flex -translate-x-1/2 items-end gap-[3px]">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="w-[2px] rounded-full"
            style={{
              background: accent,
              height: 4,
              animation: `nx-bar 1.${(i % 9) + 1}s ease-in-out ${i * 60}ms infinite`,
              opacity: active ? 1 : 0.55,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes nx-bar { 0%,100% { height: 3px; opacity:.5 } 50% { height: 16px; opacity:1 } }
        @keyframes nx-float { 0%,100% { transform: translateY(0) rotate(0deg) } 50% { transform: translateY(-6px) rotate(-0.4deg) } }
        @keyframes nx-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.015) } }
      `}</style>
    </div>
  );
}

/* ============================ Primitives ============================ */

function GlassCard({ className = "", children, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={[
        "relative rounded-2xl ring-1 ring-white/10",
        "shadow-[0_40px_100px_-30px_oklch(0_0_0/0.8),inset_0_1px_0_oklch(1_0_0/0.08)]",
        "backdrop-blur-2xl backdrop-saturate-150",
        className,
      ].join(" ")}
      style={{
        backgroundImage:
          "linear-gradient(180deg, oklch(1 0 0 / 0.05), oklch(1 0 0 / 0.015) 40%, oklch(1 0 0 / 0.025))",
        backgroundColor: "oklch(0.18 0.02 265 / 0.55)",
        ...style,
      }}
    >
      {/* top sheen */}
      <span aria-hidden className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      {/* left edge highlight */}
      <span aria-hidden className="pointer-events-none absolute inset-y-3 left-0 w-px rounded-full bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      {children}
    </div>
  );
}
