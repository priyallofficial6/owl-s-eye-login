import { useCallback, useEffect, useRef, useState } from "react";
import roundAsset from "@/assets/softwarevala-round.asset.json";
import longAsset from "@/assets/softwarevala-long.asset.json";

/* ---------------- Effect catalog ---------------- */

type Particle = {
  id: number;
  x: number;
  y: number;
  rot: number;
  scale: number;
  glyph: string;
  dur: number;
  delay: number;
};

const COMMON_GLYPHS = [
  "❤️","💋","🫧","✨","💎","🦋","🌸","🌟","🎉","⚡","🔥","🚀","🪙","🏆","👑","🎁","🌈","💫","🎊","🕊️",
];
const CURRENCY_GLYPHS = ["$","€","£","¥","₹","₿","د.إ","﷼"];
const RARE_GLYPHS = ["👑","💎","🚀","🏆","🌎","✨"];

function pickEffect(): { glyphs: string[]; count: number; rare: boolean } {
  const roll = Math.random();
  if (roll < 0.01) {
    return { glyphs: [RARE_GLYPHS[Math.floor(Math.random() * RARE_GLYPHS.length)]], count: 16, rare: true };
  }
  if (roll < 0.21) {
    return { glyphs: CURRENCY_GLYPHS, count: 11, rare: false };
  }
  const g = COMMON_GLYPHS[Math.floor(Math.random() * COMMON_GLYPHS.length)];
  return { glyphs: [g], count: 9, rare: false };
}

function buildParticles(): Particle[] {
  const { glyphs, count } = pickEffect();
  const parts: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Rain-like: emit gently around the logo, then drift slowly down with gravity
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const dist = 50 + Math.random() * 70;
    const driftX = Math.cos(angle) * dist + (Math.random() - 0.5) * 30;
    // bias Y downward so particles "rain" rather than blast upward
    const fallY = 90 + Math.random() * 140;
    parts.push({
      id: Math.random(),
      x: driftX,
      y: fallY,
      rot: (Math.random() - 0.5) * 60,
      scale: 0.8 + Math.random() * 0.7,
      glyph: glyphs[i % glyphs.length],
      dur: 2600 + Math.random() * 1800, // slow fall: 2.6s – 4.4s
      delay: Math.random() * 900,        // staggered like raindrops
    });
  }
  return parts;
}


/* ---------------- Component ---------------- */

type Props = {
  variant?: "round" | "long";
  size?: number;
  className?: string;
  ariaLabel?: string;
};

export function BrandLogo({
  variant = "round",
  size,
  className = "",
  ariaLabel = "Software Vala",
}: Props) {
  const [bursts, setBursts] = useState<{ id: number; particles: Particle[]; rare: boolean }[]>([]);
  const [pressed, setPressed] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50, hover: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const counter = useRef(0);

  const isRound = variant === "round";
  const dim = size ?? (isRound ? 44 : 38);

  const trigger = useCallback(() => {
    counter.current += 1;
    const id = counter.current;
    const particles = buildParticles();
    const rare = Math.random() < 0.01;
    setBursts((b) => [...b, { id, particles, rare }]);
    setPulseKey((k) => k + 1);
    window.setTimeout(() => {
      setBursts((b) => b.filter((x) => x.id !== id));
    }, 6500);
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;
    const ry = (px - 0.5) * 18; // rotateY
    const rx = -(py - 0.5) * 18; // rotateX
    setTilt({ rx, ry, mx: px * 100, my: py * 100, hover: true });
  };
  const onLeave = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 50, hover: false });

  // keyboard activation feedback
  useEffect(() => {
    if (!pressed) return;
    const t = window.setTimeout(() => setPressed(false), 180);
    return () => window.clearTimeout(t);
  }, [pressed]);

  const lift = tilt.hover ? -2 : 0;
  const scale = pressed ? 0.94 : tilt.hover ? 1.04 : 1;

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={() => {
        setPressed(true);
        trigger();
      }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      aria-label={ariaLabel}
      className={`group relative inline-flex shrink-0 select-none items-center justify-center outline-none ${className}`}
      style={{
        width: isRound ? dim + 14 : "auto",
        height: dim + 14,
        // 3D perspective stage
        perspective: "600px",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Floating drop shadow under the button — separates it from sidebar */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] blur-md transition-all duration-300"
        style={{
          bottom: 2,
          width: dim * 0.85,
          height: 8,
          background: "radial-gradient(ellipse, oklch(0 0 0 / 0.55), transparent 70%)",
          transform: `translateX(-50%) scale(${tilt.hover ? 1.15 : 1}, ${pressed ? 0.6 : 1})`,
          opacity: pressed ? 0.45 : tilt.hover ? 0.9 : 0.7,
        }}
      />

      {/* Expanding ring on click */}
      <span
        key={pulseKey}
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto rounded-full"
        style={{
          width: dim,
          height: dim,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          animation: pulseKey ? "sv-ring 950ms ease-out forwards" : "none",
          background:
            "radial-gradient(circle, oklch(0.82 0.18 250 / 0.6), oklch(0.82 0.18 250 / 0) 70%)",
        }}
      />

      {/* Idle breathing aura */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto rounded-full blur-lg"
        style={{
          width: dim * 1.15,
          height: dim * 1.15,
          background:
            "radial-gradient(circle, oklch(0.78 0.18 250 / 0.45), transparent 65%)",
          animation: "sv-breathe 4.5s ease-in-out infinite",
          opacity: tilt.hover ? 1 : 0.7,
          transition: "opacity 240ms ease",
        }}
      />

      {/* The 3D button capsule */}
      <span
        className="relative inline-flex items-center justify-center"
        style={{
          width: isRound ? dim : "auto",
          height: dim,
          transform: `translateY(${lift}px) scale(${scale}) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
          transition: pressed
            ? "transform 120ms cubic-bezier(.2,.9,.2,1.2)"
            : "transform 380ms cubic-bezier(.2,.9,.2,1.2)",
          willChange: "transform",
        }}
      >
        {/* Outer ring / premium border */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            borderRadius: isRound ? 9999 : 14,
            background:
              "linear-gradient(135deg, oklch(0.85 0.05 250 / 0.55), oklch(0.5 0.02 260 / 0.2) 45%, oklch(0.85 0.05 250 / 0.5))",
            padding: 1,
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Glass body */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            borderRadius: isRound ? 9999 : 14,
            background:
              "linear-gradient(160deg, oklch(0.32 0.04 260 / 0.85), oklch(0.18 0.02 260 / 0.85))",
            backdropFilter: "blur(10px) saturate(140%)",
            boxShadow: pressed
              ? "0 2px 6px -2px oklch(0 0 0 / 0.6), inset 0 2px 4px oklch(0 0 0 / 0.45), inset 0 -1px 0 oklch(1 0 0 / 0.06)"
              : "0 10px 24px -10px oklch(0 0 0 / 0.75), 0 2px 0 oklch(0 0 0 / 0.4), inset 0 1px 0 oklch(1 0 0 / 0.18), inset 0 -2px 6px oklch(0 0 0 / 0.45)",
            transition: "box-shadow 220ms ease",
          }}
        />

        {/* Specular highlight that tracks the cursor */}
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: isRound ? 9999 : 14 }}
        >
          <span
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, oklch(1 0 0 / 0.35), transparent 45%)`,
              opacity: tilt.hover ? 1 : 0.55,
              mixBlendMode: "screen",
            }}
          />
          {/* top sheen */}
          <span
            className="absolute inset-x-2 top-0 h-1/2"
            style={{
              borderRadius: isRound ? 9999 : 12,
              background:
                "linear-gradient(180deg, oklch(1 0 0 / 0.22), transparent)",
              filter: "blur(2px)",
            }}
          />
        </span>

        {/* Logo image — sits on top of the glass surface */}
        <span
          className="relative z-[1] inline-flex items-center justify-center"
          style={{
            transform: "translateZ(14px)",
          }}
        >
          {isRound ? (
            <img
              src={roundAsset.url}
              alt=""
              draggable={false}
              className="rounded-full"
              style={{
                width: dim - 8,
                height: dim - 8,
                objectFit: "cover",
                filter: tilt.hover
                  ? "drop-shadow(0 4px 10px oklch(0.78 0.18 250 / 0.45))"
                  : "drop-shadow(0 2px 6px oklch(0 0 0 / 0.5))",
                transition: "filter 240ms ease",
              }}
            />
          ) : (
            <img
              src={longAsset.url}
              alt=""
              draggable={false}
              className="block"
              style={{
                height: dim - 10,
                width: "auto",
                padding: "0 8px",
                filter: tilt.hover
                  ? "drop-shadow(0 4px 10px oklch(0.78 0.18 250 / 0.45))"
                  : "drop-shadow(0 2px 6px oklch(0 0 0 / 0.5))",
                transition: "filter 240ms ease",
              }}
            />
          )}
        </span>
      </span>

      {/* Particle bursts — emit from the logo center */}
      {bursts.map((b) => (
        <span key={b.id} aria-hidden className="pointer-events-none absolute inset-0">
          {b.particles.map((p) => (
            <span
              key={p.id}
              className="absolute left-1/2 top-1/2 inline-block font-semibold"
              style={{
                fontSize: b.rare ? 22 : 15,
                transform: "translate(-50%, -50%)",
                animation: `sv-float ${p.dur}ms cubic-bezier(.25,.46,.45,.94) ${p.delay}ms forwards`,
                ["--sv-x" as string]: `${p.x}px`,
                ["--sv-y" as string]: `${p.y}px`,
                ["--sv-rot" as string]: `${p.rot}deg`,
                ["--sv-scale" as string]: `${p.scale}`,
                textShadow:
                  "0 2px 8px rgba(0,0,0,0.45), 0 0 14px oklch(0.82 0.18 250 / 0.55)",
              }}
            >
              {p.glyph}
            </span>
          ))}
        </span>
      ))}

      <style>{`
        @keyframes sv-ring {
          0% { transform: scale(0.6); opacity: 0.95; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes sv-breathe {
          0%,100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.08); opacity: 0.9; }
        }
        @keyframes sv-float {
          0%   { transform: translate(-50%, -50%) scale(0.5) rotate(0deg); opacity: 0; }
          12%  { opacity: 1; }
          25%  {
            transform:
              translate(calc(-50% + calc(var(--sv-x) * 0.35)), calc(-50% + calc(var(--sv-y) * 0.2) - 14px))
              scale(var(--sv-scale)) rotate(calc(var(--sv-rot) * 0.4));
            opacity: 1;
          }
          80% { opacity: 0.85; }
          100% {
            transform:
              translate(calc(-50% + var(--sv-x)), calc(-50% + var(--sv-y)))
              scale(calc(var(--sv-scale) * 0.9))
              rotate(var(--sv-rot));
            opacity: 0;
          }
        }

      `}</style>
    </button>
  );
}
