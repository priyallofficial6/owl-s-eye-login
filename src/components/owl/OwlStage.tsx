import { useEffect, useMemo, useRef, useState } from "react";
import idleMp4 from "@/assets/owl2-idle.mp4.asset.json";
import greetMp4 from "@/assets/owl2-greet.mp4.asset.json";
import curiousMp4 from "@/assets/owl2-curious.mp4.asset.json";
import coverMp4 from "@/assets/owl2-cover.mp4.asset.json";
import successMp4 from "@/assets/owl2-success.mp4.asset.json";
import idleWebm from "@/assets/owl2-idle.webm.asset.json";
import greetWebm from "@/assets/owl2-greet.webm.asset.json";
import curiousWebm from "@/assets/owl2-curious.webm.asset.json";
import coverWebm from "@/assets/owl2-cover.webm.asset.json";
import successWebm from "@/assets/owl2-success.webm.asset.json";

/**
 * Rendered 3D character animation of the owl mascot.
 *
 * - High quality 1080x1080 clips of the SAME character (idle / hello wave /
 *   curious / covering eyes / thumbs-up celebration).
 * - A strict state machine drives which clip is on screen, so focus changes can
 *   never make two reactions overlap or flicker.
 * - Clips only become visible once they are fully buffered (no buffering hitch),
 *   and always play at natural real-time speed (no slow-mo).
 * - Head/body orientation follows the pointer, the touch position on mobile, and
 *   the focused element for keyboard-only navigation.
 */

export type OwlState = "idle" | "curious" | "hide" | "celebrate";
type ClipKey = OwlState | "greet";

const CLIPS: Record<ClipKey, { webm: string; mp4: string; loop: boolean; hold: number; rate: number }> = {
  // `hold` = fraction of the clip after which a one-shot reaction freezes on its
  // acted-out pose (covered eyes / thumbs-up stay held while the state is active)
  idle: { webm: idleWebm.url, mp4: idleMp4.url, loop: true, hold: 1, rate: 1 },
  greet: { webm: greetWebm.url, mp4: greetMp4.url, loop: false, hold: 0.97, rate: 1.06 },
  curious: { webm: curiousWebm.url, mp4: curiousMp4.url, loop: false, hold: 0.9, rate: 1.12 },
  hide: { webm: coverWebm.url, mp4: coverMp4.url, loop: false, hold: 0.92, rate: 1.15 },
  celebrate: { webm: successWebm.url, mp4: successMp4.url, loop: false, hold: 0.94, rate: 1.1 },
};

const ORDER: ClipKey[] = ["idle", "greet", "curious", "hide", "celebrate"];

// higher wins — a celebration can never be interrupted by a focus change,
// and the private/eyes-covered pose always beats plain curiosity.
const PRIORITY: Record<ClipKey, number> = { idle: 0, greet: 1, curious: 2, hide: 3, celebrate: 4 };

export function OwlStage({ state = "idle" }: { state?: OwlState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Partial<Record<ClipKey, HTMLVideoElement | null>>>({});
  const [ready, setReady] = useState<Partial<Record<ClipKey, boolean>>>({});
  const [active, setActive] = useState<ClipKey>("idle");
  const activeRef = useRef<ClipKey>("idle");
  const greetDone = useRef(false);
  const lockUntil = useRef(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // ---- state machine -------------------------------------------------------
  // A single resolver decides the on-screen clip. Requests that arrive while a
  // higher-priority reaction is still playing its entry are queued, never mixed.
  const pending = useRef<OwlState>("idle");

  useEffect(() => {
    pending.current = state;

    const resolve = () => {
      const now = performance.now();
      const want: ClipKey = !greetDone.current ? "greet" : pending.current;
      const cur = activeRef.current;
      if (want === cur) return;

      // don't cut a running reaction off mid-gesture unless something with a
      // strictly higher priority asks for the stage
      if (now < lockUntil.current && PRIORITY[want] <= PRIORITY[cur]) return;

      // never show a clip that is not fully buffered — prevents the hitch
      if (!ready[want] && want !== "idle") return;

      activeRef.current = want;
      setActive(want);

      const cfg = CLIPS[want];
      const el = videoRefs.current[want];
      if (el) {
        el.playbackRate = cfg.rate;
        if (!cfg.loop) {
          try {
            el.currentTime = 0;
          } catch {
            /* ignore */
          }
        }
        void el.play().catch(() => undefined);
      }
      // entry gesture is roughly the first 60% of a one-shot clip
      lockUntil.current = cfg.loop ? 0 : now + (el?.duration ? el.duration * 0.6 * 1000 : 1600) / cfg.rate;

      // pause the clips we left behind once they have faded out
      window.setTimeout(() => {
        for (const key of ORDER) {
          if (key === activeRef.current) continue;
          const other = videoRefs.current[key];
          if (other && !CLIPS[key].loop) other.pause();
        }
      }, 520);
    };

    resolve();
    const id = window.setInterval(resolve, 120);
    return () => window.clearInterval(id);
  }, [state, ready]);

  // one-shot reactions freeze on their acted-out pose instead of drifting back
  const onProgress = (key: ClipKey) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const el = e.currentTarget;
    const cfg = CLIPS[key];
    if (cfg.loop || !el.duration || Number.isNaN(el.duration)) return;
    if (el.currentTime >= el.duration * cfg.hold) {
      el.pause();
      el.currentTime = el.duration * cfg.hold;
      if (key === "greet") greetDone.current = true;
    }
  };

  // ---- attention target: pointer, touch, and keyboard focus ----------------
  useEffect(() => {
    let raf = 0;
    let target = { x: 0, y: 0 };

    const aim = (clientX: number, clientY: number) => {
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = (clientX - (r.left + r.width / 2)) / Math.max(window.innerWidth / 2, 1);
      const ny = (clientY - (r.top + r.height / 2)) / Math.max(window.innerHeight / 2, 1);
      target = { x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) };
    };

    const onMove = (e: PointerEvent) => aim(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (t) aim(t.clientX, t.clientY);
    };
    // keyboard-only navigation: look at whatever element has focus
    const onFocus = (e: FocusEvent) => {
      const node = e.target as HTMLElement | null;
      if (!node?.getBoundingClientRect) return;
      const r = node.getBoundingClientRect();
      if (!r.width && !r.height) return;
      aim(r.left + r.width / 2, r.top + r.height / 2);
    };

    const tick = () => {
      setTilt((p) => ({
        x: p.x + (target.x - p.x) * 0.075,
        y: p.y + (target.y - p.y) * 0.075,
      }));
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("focusin", onFocus);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("focusin", onFocus);
      cancelAnimationFrame(raf);
    };
  }, []);

  const stageStyle = useMemo(
    () => ({
      transform: `translate3d(${tilt.x * 12}px, ${tilt.y * 7}px, 0) rotateY(${tilt.x * 4}deg) rotateX(${-tilt.y * 2.4}deg) scale(1.05)`,
    }),
    [tilt],
  );

  return (
    <div ref={hostRef} className="relative size-full overflow-hidden [perspective:1200px]">
      <div className="absolute inset-0 will-change-transform" style={stageStyle}>
        {ORDER.map((key) => (
          <video
            key={key}
            ref={(el) => {
              videoRefs.current[key] = el;
              if (el) el.playbackRate = CLIPS[key].rate;
            }}
            autoPlay={CLIPS[key].loop}
            loop={CLIPS[key].loop}
            muted
            playsInline
            preload="auto"
            onCanPlayThrough={() => setReady((r) => (r[key] ? r : { ...r, [key]: true }))}
            onTimeUpdate={onProgress(key)}
            aria-hidden={key !== active}
            className="absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out"
            style={{ opacity: key === active ? 1 : 0 }}
          >
            <source src={CLIPS[key].webm} type="video/webm" />
            <source src={CLIPS[key].mp4} type="video/mp4" />
          </video>
        ))}
      </div>

      {/* blend the rendered stage into the panel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(72% 62% at 50% 42%, transparent 40%, oklch(0.12 0.03 285 / 0.55) 82%, oklch(0.08 0.02 275 / 0.9) 100%)",
        }}
      />
    </div>
  );
}
