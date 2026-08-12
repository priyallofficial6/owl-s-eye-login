import { useEffect, useMemo, useRef, useState } from "react";
import idleAsset from "@/assets/owl-idle.mp4.asset.json";
import curiousAsset from "@/assets/owl-curious.mp4.asset.json";
import coverAsset from "@/assets/owl-cover.mp4.asset.json";
import successAsset from "@/assets/owl-success.mp4.asset.json";
import idleWebm from "@/assets/owl-idle.webm.asset.json";
import curiousWebm from "@/assets/owl-curious.webm.asset.json";
import coverWebm from "@/assets/owl-cover.webm.asset.json";
import successWebm from "@/assets/owl-success.webm.asset.json";

/**
 * Real rendered 3D character animation of the owl mascot.
 *
 * Each state is an actual rendered character-animation clip of the SAME owl
 * (same design, hoodie, glasses, feathers, lighting). Clips are stacked and
 * cross-dissolved, so there is no image swapping / slideshow: the idle clip is
 * a seamless multi-motion loop (breathing, blinking, head turns, weight shift,
 * hoodie + drawstring secondary motion) and the reaction clips play through
 * once and hold, then dissolve back into the living idle loop.
 *
 * A very subtle cursor-driven parallax is layered on top so the character
 * reads as reacting to the pointer without any exaggerated movement.
 */

export type OwlState = "idle" | "curious" | "hide" | "celebrate";

const CLIPS: Record<OwlState, { webm: string; mp4: string; loop: boolean }> = {
  idle: { webm: idleWebm.url, mp4: idleAsset.url, loop: true },
  curious: { webm: curiousWebm.url, mp4: curiousAsset.url, loop: false },
  hide: { webm: coverWebm.url, mp4: coverAsset.url, loop: false },
  celebrate: { webm: successWebm.url, mp4: successAsset.url, loop: false },
};


const ORDER: OwlState[] = ["idle", "curious", "hide", "celebrate"];

export function OwlStage({ state = "idle" }: { state?: OwlState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Partial<Record<OwlState, HTMLVideoElement | null>>>({});
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // play/pause the active clip; restart one-shot reactions on entry
  useEffect(() => {
    for (const key of ORDER) {
      const el = videoRefs.current[key];
      if (!el) continue;
      if (key === state) {
        if (!CLIPS[key].loop) {
          try {
            el.currentTime = 0;
          } catch {
            /* ignore */
          }
        }
        void el.play().catch(() => undefined);
      } else if (!CLIPS[key].loop) {
        el.pause();
      }
    }
  }, [state]);

  // subtle pointer parallax — elegant, never exaggerated
  useEffect(() => {
    let raf = 0;
    let target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / Math.max(window.innerWidth / 2, 1);
      const ny = (e.clientY - (r.top + r.height / 2)) / Math.max(window.innerHeight / 2, 1);
      target = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      };
    };
    const tick = () => {
      setTilt((p) => ({
        x: p.x + (target.x - p.x) * 0.055,
        y: p.y + (target.y - p.y) * 0.055,
      }));
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const stageStyle = useMemo(
    () => ({
      transform: `translate3d(${tilt.x * 10}px, ${tilt.y * 6}px, 0) rotateY(${tilt.x * 3.2}deg) rotateX(${-tilt.y * 2}deg) scale(1.04)`,
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
            }}
            src={CLIPS[key].url}
            autoPlay={CLIPS[key].loop}
            loop={CLIPS[key].loop}
            muted
            playsInline
            preload="auto"
            aria-hidden={key !== state}
            className="absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out"
            style={{ opacity: key === state ? 1 : 0 }}
          />
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
