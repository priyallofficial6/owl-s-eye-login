import { useEffect, useRef, useState } from "react";

/**
 * Fully vector, rigged owl character.
 *
 * There is NO image / frame swapping anywhere in this file — the owl is one SVG
 * skeleton whose joints (head, neck, wings, brows, lids, pupils, body) are driven
 * by critically-damped springs on a single rAF loop. Every pose the owl reaches
 * (cursor follow, curious lean, eyes covered, celebration) is the same rig moving
 * physically from wherever it currently is, so motion always has follow-through
 * and never snaps.
 */

export type OwlPose = "idle" | "curious" | "hide" | "celebrate" | "concerned";

/* ------------------------------- spring rig ------------------------------- */

type Spring = { v: number; x: number; k: number; d: number };
const spring = (x: number, k = 90, d = 14): Spring => ({ v: 0, x, k, d });

function step(s: Spring, target: number, dt: number) {
  // semi-implicit euler, sub-stepped for stability at low frame rates
  const steps = Math.min(4, Math.max(1, Math.ceil(dt / 0.008)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const a = (target - s.x) * s.k - s.v * s.d;
    s.v += a * h;
    s.x += s.v * h;
  }
  return s.x;
}

type Joints = {
  headX: number; headY: number; headRot: number;
  bodyX: number; bodyY: number; bodyRot: number;
  pupilX: number; pupilY: number;
  lid: number; brow: number;
  wingL: number; wingR: number; wingLift: number;
  thumb: number; blushA: number; smile: number;
};

const REST: Joints = {
  headX: 0, headY: 0, headRot: 0,
  bodyX: 0, bodyY: 0, bodyRot: 0,
  pupilX: 0, pupilY: 0,
  lid: 0, brow: 0,
  wingL: 0, wingR: 0, wingLift: 0,
  thumb: 0, blushA: 0, smile: 0,
};

export function OwlCharacter({ pose = "idle" }: { pose?: OwlPose }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [j, setJ] = useState<Joints>(REST);

  const poseRef = useRef(pose);
  poseRef.current = pose;

  // pointer target in normalized [-1,1] relative to the owl's head
  const aim = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.34;
      aim.current = {
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / Math.max(r.width * 0.9, 1))),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / Math.max(r.height * 0.9, 1))),
      };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    const S = {
      headX: spring(0, 70, 13), headY: spring(0, 70, 13), headRot: spring(0, 55, 12),
      bodyX: spring(0, 40, 11), bodyY: spring(0, 45, 12), bodyRot: spring(0, 38, 11),
      pupilX: spring(0, 150, 18), pupilY: spring(0, 150, 18),
      lid: spring(0, 320, 26), brow: spring(0, 90, 14),
      wingL: spring(0, 95, 15), wingR: spring(0, 95, 15), wingLift: spring(0, 80, 14),
      thumb: spring(0, 110, 17), blushA: spring(0, 40, 12), smile: spring(0, 60, 13),
    };

    let raf = 0;
    let last = performance.now();
    let t = 0;

    // organic blink scheduling (double-blinks, random idle saccades)
    let blinkUntil = 0;
    let nextBlink = 900 + Math.random() * 2200;
    let sacc = { x: 0, y: 0 };
    let nextSacc = 1200;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt * 1000;

      const p = poseRef.current;

      if (t > nextBlink) {
        blinkUntil = t + (Math.random() < 0.25 ? 230 : 110);
        nextBlink = t + 1400 + Math.random() * 3600;
      }
      if (t > nextSacc) {
        sacc = { x: (Math.random() - 0.5) * 0.35, y: (Math.random() - 0.5) * 0.22 };
        nextSacc = t + 700 + Math.random() * 1800;
      }

      const breathe = Math.sin(t / 1000 * 1.15);
      const sway = Math.sin(t / 1000 * 0.62);
      const bob = Math.sin(t / 1000 * 1.9);

      const ax = aim.current.x, ay = aim.current.y;

      // ---- targets per pose (all continuous; springs do the transition) ----
      let tHeadX = ax * 16, tHeadY = ay * 9 + breathe * 1.4;
      let tHeadRot = ax * 8 + sway * 1.2;
      let tBodyX = ax * 6 + sway * 3, tBodyY = breathe * 3.2, tBodyRot = ax * 2.4 + sway * 0.9;
      let tPupX = (ax + sacc.x) * 9, tPupY = (ay + sacc.y) * 6;
      let tBrow = 0, tWingL = sway * 3, tWingR = -sway * 3, tLift = 0, tThumb = 0;
      let tBlush = 0, tSmile = 0.25;
      let lidTarget = t < blinkUntil ? 1 : 0;

      if (p === "curious") {
        // leans in toward the form (form sits to the owl's left / screen-left)
        tHeadX = -20 + ax * 8;
        tHeadY = 12 + ay * 4;
        tHeadRot = -11 + ax * 3 + sway * 1.2;
        tBodyX = -12 + ax * 3;
        tBodyY = 6 + breathe * 2.4;
        tBodyRot = -5 + sway * 0.8;
        tPupX = -11 + sacc.x * 3;
        tPupY = 5;
        tBrow = 1;
        tWingL = 16;
        tWingR = -6;
        tSmile = 0.5;
        tBlush = 0.25;
      } else if (p === "hide") {
        // physically swings both wings up over the eyes, ducks the head a touch
        tHeadX = 0; tHeadY = 7 + breathe * 1.2; tHeadRot = sway * 2.5;
        tBodyX = 0; tBodyY = 5 + breathe * 2.6; tBodyRot = sway * 1.4;
        tPupX = 0; tPupY = 3;
        tWingL = 74; tWingR = -74; tLift = 1;
        tBrow = 0.4; tSmile = 0.8; tBlush = 1;
        lidTarget = 1;
      } else if (p === "celebrate") {
        tHeadX = ax * 6; tHeadY = -6 + bob * 2.5; tHeadRot = 7 + bob * 3;
        tBodyX = 0; tBodyY = -6 + Math.abs(bob) * -4; tBodyRot = 3 + bob * 1.6;
        tPupX = 4; tPupY = -3;
        tWingL = -8; tWingR = -46; tThumb = 1;
        tBrow = -0.6; tSmile = 1; tBlush = 0.8;
        // happy wink on the right eye handled below via winkRef
      } else if (p === "concerned") {
        tHeadX = ax * 8; tHeadY = 8; tHeadRot = Math.sin(t / 120) * 5;
        tBodyRot = Math.sin(t / 140) * 2;
        tBrow = -1; tSmile = -0.7; tPupY = 6;
      }

      const out: Joints = {
        headX: step(S.headX, tHeadX, dt),
        headY: step(S.headY, tHeadY, dt),
        headRot: step(S.headRot, tHeadRot, dt),
        bodyX: step(S.bodyX, tBodyX, dt),
        bodyY: step(S.bodyY, tBodyY, dt),
        bodyRot: step(S.bodyRot, tBodyRot, dt),
        pupilX: step(S.pupilX, tPupX, dt),
        pupilY: step(S.pupilY, tPupY, dt),
        lid: step(S.lid, lidTarget, dt),
        brow: step(S.brow, tBrow, dt),
        wingL: step(S.wingL, tWingL, dt),
        wingR: step(S.wingR, tWingR, dt),
        wingLift: step(S.wingLift, tLift, dt),
        thumb: step(S.thumb, tThumb, dt),
        blushA: step(S.blushA, tBlush, dt),
        smile: step(S.smile, tSmile, dt),
      };
      setJ(out);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const lidL = Math.max(0.02, 1 - j.lid);
  const winkR = pose === "celebrate" ? 0.06 : lidL;

  return (
    <div ref={hostRef} className="relative size-full">
      <svg viewBox="0 0 400 470" className="size-full" role="img" aria-label="Vala the owl concierge">
        <defs>
          <radialGradient id="ow-floor" cx="50%" cy="50%">
            <stop offset="0%" stopColor="oklch(0.72 0.17 305)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="oklch(0.72 0.17 305)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ow-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.11 310)" />
            <stop offset="55%" stopColor="oklch(0.70 0.13 305)" />
            <stop offset="100%" stopColor="oklch(0.53 0.13 300)" />
          </linearGradient>
          <linearGradient id="ow-hood" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.12 190)" />
            <stop offset="60%" stopColor="oklch(0.63 0.12 192)" />
            <stop offset="100%" stopColor="oklch(0.48 0.10 195)" />
          </linearGradient>
          <linearGradient id="ow-wing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.12 305)" />
            <stop offset="100%" stopColor="oklch(0.50 0.13 298)" />
          </linearGradient>
          <linearGradient id="ow-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.94 0.045 300)" />
            <stop offset="100%" stopColor="oklch(0.83 0.07 300)" />
          </linearGradient>
          <radialGradient id="ow-eye" cx="42%" cy="35%">
            <stop offset="0%" stopColor="oklch(0.93 0.15 85)" />
            <stop offset="70%" stopColor="oklch(0.82 0.18 70)" />
            <stop offset="100%" stopColor="oklch(0.62 0.16 55)" />
          </radialGradient>
          <linearGradient id="ow-beak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.87 0.15 75)" />
            <stop offset="100%" stopColor="oklch(0.70 0.16 55)" />
          </linearGradient>
          <clipPath id="ow-eyeL"><circle cx="163" cy="176" r="27" /></clipPath>
          <clipPath id="ow-eyeR"><circle cx="237" cy="176" r="27" /></clipPath>
        </defs>

        {/* contact shadow */}
        <ellipse cx="200" cy="437" rx={104 - j.bodyY} ry="17" fill="url(#ow-floor)" />

        <g transform={`translate(${200 + j.bodyX} ${240 + j.bodyY}) rotate(${j.bodyRot}) translate(-200 -240)`}>
          {/* feet */}
          <g fill="oklch(0.80 0.16 70)" stroke="oklch(0.55 0.14 55)" strokeWidth="3" strokeLinejoin="round">
            <path d="M168 424c-14 2-22 6-22 10s10 5 22 5 20-2 20-6-6-10-20-9z" />
            <path d="M232 424c14 2 22 6 22 10s-10 5-22 5-20-2-20-6 6-10 20-9z" />
          </g>

          {/* tail feathers */}
          <path d="M200 372c-30 6-52 24-58 44 22-6 40-8 58-8s36 2 58 8c-6-20-28-38-58-44z"
            fill="oklch(0.46 0.12 300)" opacity="0.95" />

          {/* body */}
          <path d="M200 148c-64 0-104 52-104 128 0 74 44 122 104 122s104-48 104-122c0-76-40-128-104-128z"
            fill="url(#ow-body)" />
          {/* chest plumage */}
          <path d="M200 214c-40 0-64 34-64 80 0 44 26 74 64 74s64-30 64-74c0-46-24-80-64-80z"
            fill="oklch(0.93 0.04 305)" opacity="0.55" />
          {[248, 282, 316].map((y, i) => (
            <g key={y} opacity={0.35 - i * 0.06} fill="none" stroke="oklch(0.45 0.10 300)" strokeWidth="2.5" strokeLinecap="round">
              <path d={`M${170 - i * 4} ${y}q14 12 28 0`} />
              <path d={`M${202 - i * 4} ${y}q14 12 28 0`} />
            </g>
          ))}

          {/* hoodie: body part + collar */}
          <path d="M200 176c-58 0-92 30-100 74 10 8 22 12 34 10 8-30 30-48 66-48s58 18 66 48c12 2 24-2 34-10-8-44-42-74-100-74z"
            fill="url(#ow-hood)" />
          <path d="M136 258c-4 34 6 60 26 76-2-30-2-56 4-78-10 4-20 5-30 2z" fill="oklch(0.55 0.11 193)" />
          <path d="M264 258c4 34-6 60-26 76 2-30 2-56-4-78 10 4 20 5 30 2z" fill="oklch(0.55 0.11 193)" />
          {/* drawstrings */}
          <g stroke="oklch(0.88 0.05 195)" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M182 246c-4 20-6 34-4 48" />
            <path d="M218 246c4 20 6 34 4 48" />
          </g>

          {/* ---------------- LEFT WING (screen-left) ---------------- */}
          <g transform={`translate(112 250) rotate(${-j.wingL}) translate(${-j.wingLift * 6} ${-j.wingLift * 10}) translate(-112 -250)`}>
            <path d="M112 218c-26 10-38 42-34 82 3 32 16 56 30 66 8 6 16 2 15-8-6-42-6-84 2-124 2-12-4-20-13-16z"
              fill="url(#ow-wing)" stroke="oklch(0.42 0.11 300)" strokeWidth="2" />
            <path d="M104 262c-6 26-6 54 0 78" fill="none" stroke="oklch(0.40 0.10 300)" strokeWidth="2.5" opacity="0.5" />
            {/* wing hand / tip */}
            <ellipse cx="118" cy="352" rx="17" ry="20" fill="oklch(0.66 0.13 302)" />
          </g>

          {/* ---------------- RIGHT WING (screen-right) ---------------- */}
          <g transform={`translate(288 250) rotate(${-j.wingR}) translate(${j.wingLift * 6} ${-j.wingLift * 10}) translate(-288 -250)`}>
            <path d="M288 218c26 10 38 42 34 82-3 32-16 56-30 66-8 6-16 2-15-8 6-42 6-84-2-124-2-12 4-20 13-16z"
              fill="url(#ow-wing)" stroke="oklch(0.42 0.11 300)" strokeWidth="2" />
            <path d="M296 262c6 26 6 54 0 78" fill="none" stroke="oklch(0.40 0.10 300)" strokeWidth="2.5" opacity="0.5" />
            <ellipse cx="282" cy="352" rx="17" ry="20" fill="oklch(0.66 0.13 302)" />
            {/* thumb — extends out of the same wing hand when celebrating */}
            <g opacity={j.thumb} transform={`translate(282 340) rotate(${-18 * j.thumb}) scale(${0.75 + 0.25 * j.thumb}) translate(-282 -340)`}>
              <path d="M280 336c0-14 4-24 10-24s8 10 6 22c6 0 10 4 9 10-1 8-8 12-18 12-9 0-14-6-14-12 0-4 3-7 7-8z"
                fill="oklch(0.70 0.13 303)" stroke="oklch(0.42 0.11 300)" strokeWidth="2" strokeLinejoin="round" />
            </g>
          </g>

          {/* ---------------- HEAD ---------------- */}
          <g transform={`translate(${200 + j.headX} ${196 + j.headY}) rotate(${j.headRot}) translate(-200 -196)`}>
            {/* ear tufts */}
            <path d="M128 132c-8-28-4-52 6-58 10-6 24 10 32 32z" fill="oklch(0.58 0.13 300)" />
            <path d="M272 132c8-28 4-52-6-58-10-6-24 10-32 32z" fill="oklch(0.58 0.13 300)" />
            {/* skull */}
            <ellipse cx="200" cy="168" rx="104" ry="96" fill="url(#ow-body)" />
            {/* hood over the head */}
            <path d="M200 66c-64 0-108 44-110 104 0 10 2 18 6 24 8-56 50-92 104-92s96 36 104 92c4-6 6-14 6-24-2-60-46-104-110-104z"
              fill="url(#ow-hood)" />
            <path d="M96 176c-14 8-22 22-20 36 10 8 22 10 34 6-8-12-13-26-14-42z" fill="oklch(0.55 0.11 193)" />
            <path d="M304 176c14 8 22 22 20 36-10 8-22 10-34 6 8-12 13-26 14-42z" fill="oklch(0.55 0.11 193)" />

            {/* facial disc */}
            <path d="M200 96c-52 0-86 34-86 84 0 46 36 78 86 78s86-32 86-78c0-50-34-84-86-84z" fill="url(#ow-face)" />

            {/* blush */}
            <g opacity={j.blushA * 0.75} fill="oklch(0.78 0.14 20)">
              <ellipse cx="136" cy="206" rx="20" ry="11" />
              <ellipse cx="264" cy="206" rx="20" ry="11" />
            </g>

            {/* eyes */}
            <g>
              <circle cx="163" cy="176" r="27" fill="url(#ow-eye)" />
              <circle cx="237" cy="176" r="27" fill="url(#ow-eye)" />
              <g clipPath="url(#ow-eyeL)">
                <circle cx={163 + j.pupilX} cy={176 + j.pupilY} r="12.5" fill="oklch(0.16 0.03 300)" />
                <circle cx={158 + j.pupilX} cy={170 + j.pupilY} r="4.4" fill="oklch(0.99 0.01 300)" opacity="0.9" />
              </g>
              <g clipPath="url(#ow-eyeR)">
                <circle cx={237 + j.pupilX} cy={176 + j.pupilY} r="12.5" fill="oklch(0.16 0.03 300)" />
                <circle cx={232 + j.pupilX} cy={170 + j.pupilY} r="4.4" fill="oklch(0.99 0.01 300)" opacity="0.9" />
              </g>
              {/* lids close by scaling the eyelid plate — continuous, not a swap */}
              <g clipPath="url(#ow-eyeL)">
                <rect x="130" y="149" width="66" height="54" fill="oklch(0.72 0.12 303)"
                  transform={`translate(0 ${149}) scale(1 ${Math.max(0.001, 1 - lidL)}) translate(0 ${-149})`}
                  style={{ transformOrigin: "0 0" }} />
              </g>
              <g clipPath="url(#ow-eyeR)">
                <rect x="204" y="149" width="66" height="54" fill="oklch(0.72 0.12 303)"
                  transform={`translate(0 ${149}) scale(1 ${Math.max(0.001, 1 - winkR)}) translate(0 ${-149})`}
                  style={{ transformOrigin: "0 0" }} />
              </g>
              {/* glasses */}
              <g fill="none" stroke="oklch(0.38 0.06 60)" strokeWidth="6">
                <circle cx="163" cy="176" r="31" />
                <circle cx="237" cy="176" r="31" />
                <path d="M194 176h12" />
                <path d="M132 172l-18-8M268 172l18-8" strokeWidth="5" />
              </g>
              {/* brows */}
              <g stroke="oklch(0.42 0.10 300)" strokeWidth="7" strokeLinecap="round" fill="none">
                <path d={`M136 ${134 - j.brow * 8}q26 ${-10 - j.brow * 6} 52 ${2 + j.brow * 2}`} />
                <path d={`M264 ${134 - j.brow * 8}q-26 ${-10 - j.brow * 6} -52 ${2 + j.brow * 2}`} />
              </g>
            </g>

            {/* beak + smile */}
            <path d={`M200 200c-11 0-18 6-18 12 0 ${12 + j.smile * 5} 8 ${20 + j.smile * 6} 18 ${20 + j.smile * 6}s18-${8 - j.smile * 2} 18-${20 + j.smile * 6}c0-6-7-12-18-12z`}
              fill="url(#ow-beak)" stroke="oklch(0.55 0.14 55)" strokeWidth="2" />
            <path d={`M178 ${236}q22 ${10 * j.smile} 44 0`} fill="none" stroke="oklch(0.45 0.09 300)"
              strokeWidth="4" strokeLinecap="round" opacity={Math.max(0, j.smile) * 0.7} />
          </g>

          {/* ---- wing tips travel OVER the face when hiding (same wing bodies, re-parented visual pass) ---- */}
          <g opacity={Math.max(0, j.wingLift)} pointerEvents="none">
            <g transform={`translate(${200 + j.headX} ${196 + j.headY}) rotate(${j.headRot}) translate(-200 -196)`}>
              <path d={`M150 ${182}c-30 6-52 26-58 52 26 6 52-4 70-24 8-9 4-30-12-28z`}
                fill="oklch(0.62 0.13 302)" stroke="oklch(0.42 0.11 300)" strokeWidth="2" strokeLinejoin="round" />
              <path d={`M250 ${182}c30 6 52 26 58 52-26 6-52-4-70-24-8-9-4-30 12-28z`}
                fill="oklch(0.62 0.13 302)" stroke="oklch(0.42 0.11 300)" strokeWidth="2" strokeLinejoin="round" />
              <g stroke="oklch(0.45 0.10 300)" strokeWidth="2" opacity="0.5" fill="none">
                <path d="M142 196q-18 14-24 32M258 196q18 14 24 32" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
