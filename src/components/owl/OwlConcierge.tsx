import { useEffect, useRef, useState } from "react";
import owlOpen from "@/assets/owl-open.png.asset.json";
import owlCovered from "@/assets/owl-covered.png.asset.json";

/**
 * Animated cybernetic owl concierge.
 *
 * - idles with a slow float + breathing motion
 * - pupils track the pointer and blink at random intervals
 * - folds its wings over its eyes ("hands on eyes") while a password/OTP/
 *   license secret is being typed, so it can never peek at the keystrokes
 */
export function OwlConcierge({
  covered,
  accent,
  alert = false,
  celebrate = false,
}: {
  covered: boolean;
  accent: string;
  alert?: boolean;
  celebrate?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  // Pointer-driven gaze
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.25;
      const dx = (e.clientX - cx) / Math.max(r.width, 1);
      const dy = (e.clientY - cy) / Math.max(r.height, 1);
      setGaze({
        x: Math.max(-1, Math.min(1, dx * 2)),
        y: Math.max(-1, Math.min(1, dy * 2)),
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Natural blinking
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        loop();
      }, 2200 + Math.random() * 4200);
    };
    loop();
    return () => clearTimeout(timer);
  }, []);

  const pupilShift = { x: gaze.x * 6, y: gaze.y * 4 };
  const headTilt = gaze.x * 3.5;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 flex items-end justify-center [animation:owl-float_7s_ease-in-out_infinite]"
    >
      <div
        className="relative h-[92%] aspect-square"
        style={{
          filter: `drop-shadow(0 24px 30px rgba(0,0,0,0.6)) drop-shadow(0 0 26px ${accent.replace(")", " / 0.35)")})`,
          transform: `rotate(${headTilt * 0.15}deg)`,
          transition: "transform 400ms ease-out",
        }}
      >
        {/* Eyes-open owl */}
        <img
          src={owlOpen.url}
          alt="Nexus · Owl concierge"
          className="absolute inset-0 size-full object-contain [animation:owl-breathe_5s_ease-in-out_infinite]"
          style={{
            opacity: covered ? 0 : 1,
            transition: "opacity 320ms ease-out",
            transform: `translateX(${gaze.x * 5}px)`,
          }}
        />

        {/* Glowing pupils that follow the pointer (hidden while wings cover eyes) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ opacity: covered ? 0 : 1, transition: "opacity 200ms ease-out" }}
        >
          {[43.6, 56.2].map((left) => (
            <span
              key={left}
              className="absolute rounded-full"
              style={{
                left: `${left}%`,
                top: "19.4%",
                width: "3.1%",
                height: "3.1%",
                marginLeft: "-1.55%",
                marginTop: "-1.55%",
                background: "oklch(0.99 0.02 220)",
                boxShadow: `0 0 14px 4px ${accent.replace(")", " / 0.9)")}`,
                transform: `translate(${pupilShift.x + gaze.x * 5}px, ${pupilShift.y}px) scaleY(${blink ? 0.08 : 1})`,
                transition: "transform 160ms ease-out",
              }}
            />
          ))}
        </div>

        {/* Wings-over-eyes owl */}
        <img
          src={owlCovered.url}
          alt=""
          aria-hidden={!covered}
          className="absolute inset-0 size-full object-contain [animation:owl-breathe_5s_ease-in-out_infinite]"
          style={{
            opacity: covered ? 1 : 0,
            transform: covered ? "scale(1)" : "scale(0.97) translateY(6px)",
            transition: "opacity 320ms ease-out, transform 420ms cubic-bezier(.2,.8,.2,1)",
          }}
        />

        {/* Reactions */}
        {alert ? (
          <div className="absolute inset-0 [animation:owl-shake_500ms_ease-in-out]" />
        ) : null}
        {celebrate ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [animation:owl-pulse_900ms_ease-out]"
            style={{ background: `radial-gradient(45% 40% at 50% 45%, ${accent.replace(")", " / 0.35)")}, transparent 70%)` }}
          />
        ) : null}
      </div>

      <style>{`
        @keyframes owl-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes owl-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.02) } }
        @keyframes owl-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
        @keyframes owl-pulse { from { opacity: 1 } to { opacity: 0 } }
      `}</style>
    </div>
  );
}
