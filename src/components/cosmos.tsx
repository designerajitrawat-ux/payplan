"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "./motion";

// The "universe" layer: a live starfield, the orbit on the landing page, the constellation the
// verifier draws, and small orbit rings that show where a milestone's money is.

type Star = { x: number; y: number; r: number; a: number; s: number; p: number; z: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number };

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let meteor: Meteor | null = null;
    let nextMeteor = performance.now() + 4000;
    let frame = 0;
    const target = { x: 0, y: 0 };
    const eye = { x: 0, y: 0 };

    const draw = (t: number) => {
      eye.x += (target.x - eye.x) * 0.04;
      eye.y += (target.y - eye.y) * 0.04;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const twinkle = reduced ? 1 : 0.6 + 0.4 * Math.sin((t / 1000) * s.s + s.p);
        ctx.globalAlpha = s.a * twinkle;
        ctx.fillStyle = s.z > 0.85 ? "#c9d6ff" : "#E8ECFF";
        ctx.beginPath();
        ctx.arc(s.x + eye.x * s.z * 18, s.y + eye.y * s.z * 18, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) {
        if (!meteor && t > nextMeteor) {
          meteor = { x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.3, vx: -7, vy: 3.2, life: 1 };
        }
        if (meteor) {
          const m = meteor;
          const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
          grad.addColorStop(0, "rgba(232,236,255,0.9)");
          grad.addColorStop(1, "rgba(232,236,255,0)");
          ctx.globalAlpha = m.life;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14);
          ctx.stroke();
          m.x += m.vx;
          m.y += m.vy;
          m.life -= 0.012;
          if (m.life <= 0) {
            meteor = null;
            nextMeteor = t + 7000 + Math.random() * 9000;
          }
        }
        frame = requestAnimationFrame(draw);
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(240, Math.round((w * h) / 6500));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.05 + 0.2,
        a: Math.random() * 0.55 + 0.15,
        s: Math.random() * 1.4 + 0.3,
        p: Math.random() * Math.PI * 2,
        z: Math.random(),
      }));
      if (reduced) draw(0);
    };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX / w - 0.5;
      target.y = e.clientY / h - 0.5;
    };

    resize();
    if (!reduced) frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}

/** Landing visual: the milestone as a planet, criteria as moons, money as a comet crossing to the freelancer. */
export function OrbitHero() {
  const reduced = useReducedMotion();
  const c = 280;
  const moons = [0, 72, 144, 216, 288];
  const pt = (deg: number, r: number) => [c + r * Math.cos((deg * Math.PI) / 180), c + r * Math.sin((deg * Math.PI) / 180)];
  const [sx, sy] = pt(160, 236);
  const [fx, fy] = pt(20, 236);
  const arc = `M ${sx} ${sy} A 236 236 0 0 1 ${fx} ${fy}`;

  return (
    <svg viewBox="0 0 560 560" className="h-auto w-full max-w-[560px]" role="img" aria-label="A $1,000 milestone with five criteria orbiting it; four have passed and money travels from the client to the freelancer">
      <defs>
        <radialGradient id="planet" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#4b3fd0" />
          <stop offset="55%" stopColor="#16206e" />
          <stop offset="100%" stopColor="#050a26" />
        </radialGradient>
        <radialGradient id="halo" r="50%">
          <stop offset="60%" stopColor="rgba(167,139,255,0)" />
          <stop offset="78%" stopColor="rgba(167,139,255,0.18)" />
          <stop offset="100%" stopColor="rgba(167,139,255,0)" />
        </radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(167,139,255,0)" />
          <stop offset="100%" stopColor="rgba(167,139,255,0.28)" />
        </linearGradient>
        <linearGradient id="tail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,197,61,0)" />
          <stop offset="100%" stopColor="rgba(255,197,61,0.95)" />
        </linearGradient>
      </defs>

      <circle cx={c} cy={c} r="236" fill="none" stroke="rgba(255,255,255,0.07)" strokeDasharray="2 6" />
      <path d={arc} fill="none" stroke="rgba(255,197,61,0.22)" strokeWidth="1.2" />
      <circle cx={c} cy={c} r="150" fill="none" stroke="rgba(255,255,255,0.09)" />
      <circle cx={c} cy={c} r="190" fill="url(#halo)" />

      <g className={reduced ? "" : "spin-slow"} style={{ transformOrigin: `${c}px ${c}px` }}>
        <path d={`M ${c} ${c} L ${c + 150} ${c - 40} A 155 155 0 0 1 ${c + 150} ${c + 40} Z`} fill="url(#beam)" opacity="0.8" />
      </g>

      <g className={reduced ? "" : "spin-slower"} style={{ transformOrigin: `${c}px ${c}px` }}>
        {moons.map((deg, i) => {
          const [x, y] = pt(deg, 150);
          const fail = i === 3;
          const color = fail ? "var(--color-flare)" : "var(--color-mint)";
          return (
            <g key={deg}>
              <circle cx={x} cy={y} r="16" fill={color} opacity="0.12" className={reduced ? "" : "breathe"} style={{ animationDelay: `${i * 0.4}s`, transformOrigin: `${x}px ${y}px` }} />
              <circle cx={x} cy={y} r="6" fill={color} />
            </g>
          );
        })}
      </g>

      <circle cx={c} cy={c} r="78" fill="url(#planet)" stroke="rgba(255,255,255,0.12)" />
      <text x={c} y={c - 4} textAnchor="middle" className="fill-ink font-sans" fontSize="30" fontWeight="600">
        $1,000
      </text>
      <text x={c} y={c + 22} textAnchor="middle" className="fill-mute" fontSize="12" letterSpacing="2">
        LOCKED ON PAYPAL
      </text>

      <g>
        <circle cx={sx} cy={sy} r="9" fill="#050a26" stroke="var(--color-ice)" strokeWidth="1.5" />
        <text x={sx - 12} y={sy + 28} textAnchor="start" className="fill-mute" fontSize="12">
          Client · USA
        </text>
        <circle cx={fx} cy={fy} r="9" fill="#050a26" stroke="var(--color-mint)" strokeWidth="1.5" />
        <text x={fx + 12} y={fy + 28} textAnchor="end" className="fill-mute" fontSize="12">
          Freelancer · India
        </text>
      </g>

      {reduced ? (
        <circle cx={c} cy={c - 236} r="4" fill="var(--color-sun)" />
      ) : (
        <g>
          <line x1="-34" y1="0" x2="0" y2="0" stroke="url(#tail)" strokeWidth="3" strokeLinecap="round" />
          <circle r="4.5" fill="#fff1c2" />
          <animateMotion dur="5s" repeatCount="indefinite" rotate="auto" path={arc} keyPoints="0;1;1" keyTimes="0;0.7;1" calcMode="spline" keySplines="0.6 0 0.3 1;0 0 1 1" />
        </g>
      )}
    </svg>
  );
}

export type StarState = "queued" | "checking" | "pass" | "fail" | "carried";

// Hand-placed points for up to eight criteria, so the shape reads like a constellation, not a chart.
const SKY = [
  [48, 170],
  [118, 96],
  [196, 140],
  [262, 62],
  [340, 118],
  [312, 196],
  [226, 214],
  [150, 206],
];

/** The verifier's constellation: each criterion is a star that lights up once it has been checked. */
export function Constellation({ states }: { states: StarState[] }) {
  const reduced = useReducedMotion();
  const points = states.map((_, i) => SKY[i % SKY.length]);
  const color = (s: StarState) => (s === "fail" ? "var(--color-flare)" : s === "pass" || s === "carried" ? "var(--color-mint)" : s === "checking" ? "var(--color-nova)" : "rgba(255,255,255,0.28)");
  const resolved = (s: StarState) => s === "pass" || s === "fail" || s === "carried";

  return (
    <svg viewBox="0 0 390 260" className="h-auto w-full" role="img" aria-label={`${states.filter(resolved).length} of ${states.length} criteria checked`}>
      {points.slice(1).map(([x, y], i) => {
        const [px, py] = points[i];
        const on = resolved(states[i]) && resolved(states[i + 1]);
        const length = Math.hypot(x - px, y - py);
        return (
          <line
            key={i}
            x1={px}
            y1={py}
            x2={x}
            y2={y}
            stroke={on ? "rgba(167,139,255,0.55)" : "rgba(255,255,255,0.06)"}
            strokeWidth="1"
            strokeDasharray={length}
            strokeDashoffset={on || reduced ? 0 : length}
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.6,0,.3,1), stroke 400ms" }}
          />
        );
      })}
      {points.map(([x, y], i) => {
        const s = states[i];
        return (
          <g key={i}>
            {s === "checking" && !reduced ? <circle cx={x} cy={y} r="10" fill="none" stroke="var(--color-nova)" className="ping" style={{ transformOrigin: `${x}px ${y}px` }} /> : null}
            <circle cx={x} cy={y} r={resolved(s) ? 16 : 10} fill={color(s)} opacity={resolved(s) ? 0.16 : 0.08} style={{ transition: "all 500ms" }} />
            <circle cx={x} cy={y} r={resolved(s) ? 5 : 3.5} fill={color(s)} style={{ transition: "all 500ms" }} />
            <text x={x} y={y - 16} textAnchor="middle" fontSize="10" className="fill-dim font-mono">
              {String(i + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Where a milestone's money is, as a small orbit: released, held, returned. */
export function OrbitRing({ captured, held, voided, size = 44 }: { captured: number; held: number; voided: number; size?: number }) {
  const total = captured + held + voided || 1;
  const r = 16;
  const circ = 2 * Math.PI * r;
  const seg = (v: number) => (v / total) * circ;
  const parts = [
    { v: seg(captured), color: "var(--color-mint)" },
    { v: seg(held), color: "var(--color-ice)" },
    { v: seg(voided), color: "rgba(255,255,255,0.25)" },
  ];
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((sum, p) => sum + p.v, 0));
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden className="-rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      {parts.map((p, i) =>
        p.v > 0 ? <circle key={i} cx="22" cy="22" r={r} fill="none" stroke={p.color} strokeWidth="4" strokeDasharray={`${Math.max(0, p.v - 1.5)} ${circ}`} strokeDashoffset={-starts[i]} strokeLinecap="round" /> : null,
      )}
    </svg>
  );
}

export type MoonState = "pending" | "verified" | "released" | "failed" | "returned";

const moonColor: Record<MoonState, string> = {
  pending: "var(--color-ice)",
  verified: "var(--color-nova)",
  released: "var(--color-mint)",
  failed: "var(--color-flare)",
  returned: "rgba(255,255,255,0.22)",
};

/**
 * The PayPal mechanic as a small solar system: the client's planet, the authorization as an orbit
 * split into criteria, and the freelancer's planet. Comets carry captured money across.
 */
export function MoneyOrbit({
  amountLabel,
  segments,
  holding,
  releasing,
  agent,
}: {
  amountLabel: string;
  segments: { weight: number; state: MoonState }[];
  holding: boolean;
  releasing: boolean;
  agent: boolean;
}) {
  const reduced = useReducedMotion();
  const cx = 360;
  const cy = 120;
  const r = 70;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.weight, 0) || 1;
  const gap = segments.length > 1 ? 6 : 0;
  const inArc = "M 140 120 C 200 70, 270 70, 300 98";
  const outArc = "M 420 98 C 450 70, 520 70, 580 120";
  const lengths = segments.map((x) => (x.weight / total) * circ);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, l) => sum + l, 0));

  return (
    <svg viewBox="0 0 720 240" className="h-auto w-full" role="img" aria-label={`${amountLabel} authorized, split into ${segments.length} criteria`}>
      <defs>
        <radialGradient id="mo-client" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#3a66ff" />
          <stop offset="100%" stopColor="#0a1446" />
        </radialGradient>
        <radialGradient id="mo-free" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#14b583" />
          <stop offset="100%" stopColor="#05362a" />
        </radialGradient>
        <linearGradient id="mo-tail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,197,61,0)" />
          <stop offset="100%" stopColor="rgba(255,197,61,0.95)" />
        </linearGradient>
      </defs>

      <path d={inArc} fill="none" stroke={holding ? "rgba(79,200,255,0.45)" : "rgba(255,255,255,0.1)"} strokeWidth="1.5" strokeDasharray="4 6" />
      <path d={outArc} fill="none" stroke={releasing ? "rgba(34,227,160,0.5)" : "rgba(255,255,255,0.1)"} strokeWidth="1.5" strokeDasharray="4 6" />

      <g>
        <circle cx="100" cy="120" r="40" fill="url(#mo-client)" stroke="rgba(79,200,255,0.45)" />
        {agent ? (
          <g className={reduced ? "" : "spin-slow"} style={{ transformOrigin: "100px 120px" }}>
            <circle cx="100" cy="120" r="58" fill="none" stroke="rgba(167,139,255,0.25)" strokeDasharray="2 5" />
            <circle cx="158" cy="120" r="6" fill="var(--color-nova)" />
          </g>
        ) : null}
      </g>

      <circle cx="620" cy="120" r="40" fill="url(#mo-free)" stroke={releasing ? "rgba(34,227,160,0.7)" : "rgba(34,227,160,0.3)"} />
      {releasing ? <circle cx="620" cy="120" r="52" fill="none" stroke="rgba(34,227,160,0.25)" className={reduced ? "" : "breathe"} style={{ transformOrigin: "620px 120px" }} /> : null}

      <circle cx={cx} cy={cy} r={r + 16} fill="rgba(167,139,255,0.04)" />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {segments.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={moonColor[s.state]}
              strokeWidth={s.state === "released" ? 9 : 7}
              strokeDasharray={`${Math.max(1, lengths[i] - gap)} ${circ}`}
              strokeDashoffset={-starts[i]}
              strokeLinecap="round"
              opacity={s.state === "pending" ? 0.55 : 1}
              style={{ transition: "stroke 600ms, stroke-width 600ms, opacity 600ms" }}
            />
        ))}
      </g>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="30" fontWeight="600" className="fill-ink font-sans">
        {amountLabel}
      </text>

      {!reduced && holding ? (
        <circle r="3" fill="var(--color-ice)">
          <animateMotion dur="3.4s" repeatCount="indefinite" path={inArc} />
        </circle>
      ) : null}
      {!reduced && releasing ? (
        <g>
          <line x1="-30" y1="0" x2="0" y2="0" stroke="url(#mo-tail)" strokeWidth="3" strokeLinecap="round" />
          <circle r="5" fill="#fff1c2" />
          <animateMotion dur="2.6s" repeatCount="indefinite" rotate="auto" path={outArc} keyPoints="0;1;1" keyTimes="0;0.75;1" calcMode="spline" keySplines="0.5 0 0.3 1;0 0 1 1" />
        </g>
      ) : null}
    </svg>
  );
}

/** A small ring that fills to the AI's confidence. */
export function ConfidenceRing({ value, tone = "mint" }: { value: number; tone?: "mint" | "flare" | "nova" }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid size-10 shrink-0 place-items-center" title={`AI confidence ${Math.round(value * 100)}%`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={`var(--color-${tone})`} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${value * circ} ${circ}`} style={{ transition: "stroke-dasharray 900ms cubic-bezier(.16,1,.3,1)" }} />
      </svg>
      <span className="font-mono text-[10px] text-ink">{Math.round(value * 100)}</span>
    </span>
  );
}
