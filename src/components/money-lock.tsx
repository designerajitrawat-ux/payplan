"use client";

import type { ReactNode } from "react";

export type SliceState = "pending" | "verified" | "released" | "failed" | "returned";

const sliceFill: Record<SliceState, string> = {
  pending: "var(--color-ice)",
  verified: "var(--color-nova)",
  released: "var(--color-mint)",
  failed: "var(--color-flare)",
  returned: "rgba(255,255,255,0.22)",
};

// The lock is drawn in a 112 × 136 box; its body's middle sits at y = 93, which the wires line up with.
const sizes = {
  md: { lock: "w-24", tile: "size-11 rounded-2xl [&_svg]:size-5", party: "mt-[58px] w-[4.75rem] sm:w-24", wire: "mt-[79px]" },
  lg: { lock: "w-32", tile: "size-14 rounded-[18px] [&_svg]:size-6", party: "mt-[78px] w-24 sm:w-28", wire: "mt-[105px]" },
};

const icons = {
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5.5 7.5l10-3.5 1.2 3.5" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="3" />
      <path d="M15.5 13.5h2" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.6 4-5 7-5s5.8 1.4 7 5" />
    </svg>
  ),
};

type Party = { label: string; value: ReactNode };

function PartyNode({ party, tone, icon, size, agent = false }: { party: Party; tone: "ice" | "mint"; icon: keyof typeof icons; size: keyof typeof sizes; agent?: boolean }) {
  const s = sizes[size];
  return (
    <div className={`flex shrink-0 flex-col items-center text-center ${s.party}`}>
      <span className={`relative grid place-items-center ring-1 ring-inset ${s.tile} ${tone === "ice" ? "bg-ice/10 text-ice ring-ice/25" : "bg-mint/10 text-mint ring-mint/25"}`}>
        {icons[icon]}
        {agent ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-nova px-1.5 py-0.5 font-mono text-[9px] font-bold leading-none text-void ring-2 ring-panel" title="The client's agent approves releases">
            AI
          </span>
        ) : null}
      </span>
      <span className="mt-2 text-[11px] leading-tight text-dim sm:text-xs">{party.label}</span>
      <span className={`mt-0.5 text-[13px] font-semibold sm:text-sm ${tone === "ice" ? "text-ice" : "text-mint"}`}>{party.value}</span>
    </div>
  );
}

/**
 * Where a milestone's money is, drawn as the product's padlock: the client's PayPal on the left, the hold in the
 * middle with one slice per criterion, the freelancer on the right. The shackle closes when the hold is approved,
 * each slice takes the colour of its verdict, and money runs along the right wire once PayPal captures.
 */
export function MoneyLock({
  amount,
  caption,
  slices,
  locked,
  releasing,
  agent = false,
  client,
  freelancer,
  size = "md",
}: {
  amount: string;
  caption: string;
  slices: { weight: number; state: SliceState }[];
  locked: boolean;
  releasing: boolean;
  agent?: boolean;
  client: Party;
  freelancer: Party;
  size?: keyof typeof sizes;
}) {
  const s = sizes[size];
  const total = slices.reduce((sum, x) => sum + x.weight, 0) || 1;
  const gap = 3;
  const room = 64 - gap * Math.max(0, slices.length - 1);
  const heights = slices.map((slice) => Math.max(4, (room * slice.weight) / total));
  const rects = slices.map((slice, i) => ({ ...slice, h: heights[i], y: 61 + heights.slice(0, i).reduce((sum, h) => sum + h + gap, 0) }));
  const allPaid = slices.length > 0 && slices.every((x) => x.state === "released");
  const glow = allPaid ? "drop-shadow-[0_0_22px_rgba(34,227,160,0.35)]" : locked ? "drop-shadow-[0_0_22px_rgba(79,200,255,0.22)]" : "";

  return (
    <div
      className="flex items-start justify-center"
      role="img"
      aria-label={`${amount} ${caption}, split into ${slices.length} criteria. ${client.label} on the left, ${freelancer.label} on the right.`}
    >
      <PartyNode party={client} tone="ice" icon="wallet" size={size} agent={agent} />
      <div className={`flow-line mx-1.5 min-w-3 flex-1 ${s.wire}`} data-active={locked} data-tone="ice" />
      <div className="flex shrink-0 flex-col items-center">
        <svg viewBox="0 0 112 136" className={`h-auto transition-[filter] duration-700 ${s.lock} ${glow}`} aria-hidden>
          {/* Open, the shackle lifts and its right leg comes out of the body, like a real padlock. */}
          <g
            fill="none"
            stroke={locked ? "#e9ecf7" : "rgba(233,236,247,0.45)"}
            strokeWidth="8"
            strokeLinecap="round"
            style={{ transform: locked ? "none" : "translateY(-14px)", transition: "transform 700ms var(--ease-out-expo), stroke 400ms" }}
          >
            <path d="M32 70V40a24 24 0 0 1 48 0" />
            <path d="M80 40v30" style={{ transform: locked ? "none" : "scaleY(0.3)", transformOrigin: "80px 40px", transition: "transform 700ms var(--ease-out-expo)" }} />
          </g>
          <rect x="8" y="52" width="96" height="82" rx="16" fill="var(--color-panel-2)" stroke="rgba(255,255,255,0.14)" />
          {rects.map((r, i) => (
            <rect
              key={i}
              x="17"
              y={r.y}
              width="78"
              height={r.h}
              rx="4"
              fill={!locked && r.state === "pending" ? "rgba(255,255,255,0.08)" : sliceFill[r.state]}
              opacity={locked && r.state === "pending" ? 0.4 : 1}
              style={{ transition: "fill 600ms, opacity 600ms" }}
            />
          ))}
        </svg>
        <p className="mt-1.5 font-sans text-base font-semibold text-ink sm:text-lg">{amount}</p>
        <p className="text-[11px] text-dim">{caption}</p>
      </div>
      <div className={`flow-line mx-1.5 min-w-3 flex-1 ${s.wire}`} data-active={releasing} data-tone="mint" />
      <PartyNode party={freelancer} tone="mint" icon="person" size={size} />
    </div>
  );
}
