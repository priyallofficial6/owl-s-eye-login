import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { approveQrSession } from "@/lib/auth-methods.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/qr-approve/$token")({
  head: () => ({
    meta: [
      { title: "Approve QR Sign-In · Software Vala Nexus OS" },
      {
        name: "description",
        content: "Approve a desktop QR sign-in request for Software Vala Nexus OS from your signed-in device.",
      },
      { property: "og:title", content: "Approve QR Sign-In · Nexus OS" },
      { property: "og:description", content: "Approve a desktop QR sign-in request from your signed-in device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QrApprovePage,
});

function QrApprovePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const approve = useServerFn(approveQrSession);
  const [state, setState] = useState<"checking" | "ready" | "working" | "done" | "error">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data?.user) {
        navigate({ to: "/login", search: { next: `/qr-approve/${token}` }, replace: true });
        return;
      }
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  const onApprove = async () => {
    setState("working");
    try {
      await approve({ data: { token } });
      setState("done");
      setMessage("Approved — your other device is signing in now.");
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Could not approve this request.");
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm space-y-5 rounded-xl border border-border p-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight">Approve sign-in</h1>
        <p className="text-sm text-muted-foreground">
          A device is requesting to sign in to your Software Vala account with this QR code.
        </p>

        {state === "checking" ? <p className="text-sm text-muted-foreground">Checking your session…</p> : null}
        {message ? <p className="text-sm text-foreground">{message}</p> : null}

        {state === "ready" || state === "working" || state === "error" ? (
          <button
            onClick={onApprove}
            disabled={state === "working"}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {state === "working" ? "Approving…" : "Approve this device"}
          </button>
        ) : null}
      </div>
    </main>
  );
}
