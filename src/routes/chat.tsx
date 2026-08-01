import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Internal Chat · Software Vala Nexus OS" },
      {
        name: "description",
        content: "Live internal team chat for Software Vala Nexus OS, with realtime messages for signed-in staff.",
      },
      { property: "og:title", content: "Internal Chat · Nexus OS" },
      { property: "og:description", content: "Live internal team chat for signed-in Software Vala staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

type Message = { id: string; user_id: string; body: string; created_at: string };

function ChatPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data?.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setUserId(data.user.id);

      const [{ data: rows }, { data: profiles }] = await Promise.all([
        supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200),
        supabase.from("profiles").select("id, full_name, username"),
      ]);
      if (cancelled) return;
      setMessages((rows as Message[]) ?? []);
      const map: Record<string, string> = {};
      for (const p of profiles ?? []) {
        map[String(p.id)] = String(p.full_name ?? p.username ?? "Teammate");
      }
      setNames(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const channel = supabase
      .channel("chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => {
            const next = payload.new as Message;
            return prev.some((m) => m.id === next.id) ? prev : [...prev, next];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !userId) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({ user_id: userId, body });
    setSending(false);
    if (!error) setDraft("");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-background px-6 py-10 text-foreground">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Internal Chat</h1>
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
          Back to sign-in
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-border p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet — start the conversation.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.user_id === userId ? "text-right" : ""}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {m.user_id === userId ? "You" : (names[m.user_id] ?? "Teammate")}
              </p>
              <p className="inline-block rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                {m.body}
              </p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
