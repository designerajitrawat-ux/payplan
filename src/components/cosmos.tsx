"use client";

import { useReducedMotion } from "./motion";

// The "universe" layer: the constellation the verifier draws, small orbit rings that show where a
// milestone's money is, and the AI's confidence ring.

export type StarState = "queued" | "checking" | "pass" | "fail" | "review" | "carried";

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
  const color = (s: StarState) =>
    s === "fail" ? "var(--color-flare)" : s === "review" ? "var(--color-sun)" : s === "pass" || s === "carried" ? "var(--color-mint)" : s === "checking" ? "var(--color-nova)" : "rgba(255,255,255,0.28)";
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

/** A small ring that fills to the AI's confidence. */
/** Ring colour for a verdict: green passed, red not met, amber needs a person. */
export const verdictTone = (verdict: "pass" | "fail" | "review") => (verdict === "pass" ? "mint" : verdict === "fail" ? "flare" : "sun") as "mint" | "flare" | "sun";

export function ConfidenceRing({ value, tone = "mint" }: { value: number; tone?: "mint" | "flare" | "nova" | "sun" }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const title = tone === "flare" ? `Not met · the AI is ${Math.round(value * 100)}% sure` : tone === "sun" ? "Needs a person to decide" : `AI confidence ${Math.round(value * 100)}%`;
  return (
    <span className="relative inline-grid size-10 shrink-0 place-items-center" title={title}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={`var(--color-${tone})`} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${value * circ} ${circ}`} style={{ transition: "stroke-dasharray 900ms cubic-bezier(.16,1,.3,1)" }} />
      </svg>
      {tone === "flare" ? (
        <svg viewBox="0 0 16 16" className="size-3.5 text-flare" role="img" aria-label="Not met">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      ) : tone === "sun" ? (
        <span className="font-mono text-sm font-semibold text-sun" role="img" aria-label="Needs a person">
          ?
        </span>
      ) : (
        <span className="font-mono text-[11px] text-ink">{Math.round(value * 100)}</span>
      )}
    </span>
  );
}
