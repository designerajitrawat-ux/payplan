import type { MilestoneStatus } from "@/lib/types";

const steps = ["Agree", "Lock", "Deliver", "Verify", "Decide", "Release"];

const currentIndex: Record<MilestoneStatus, number> = {
  awaiting_funding: 1,
  funded: 2,
  verifying: 3,
  awaiting_decision: 4,
  appealed: 4,
  fix_window: 5,
  released: 6,
  closed: 6,
};

/** Six-step mission timeline: filled segments are done, the glowing one is now. */
export function FlowSteps({ status }: { status: MilestoneStatus }) {
  const current = currentIndex[status];
  return (
    <ol className="grid grid-cols-6 gap-1.5" aria-label="Milestone progress">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="min-w-0">
            <span
              className={`block h-1 rounded-full transition-colors duration-700 ${
                state === "done" ? "bg-nova/80" : state === "current" ? "bg-gradient-to-r from-nova to-nova/10 shadow-[0_0_12px_rgba(185,162,255,0.6)]" : "bg-white/[0.08]"
              }`}
            />
            <span className={`mt-2 block truncate text-[11px] font-medium sm:text-xs ${state === "todo" ? "text-dim" : state === "current" ? "text-ink" : "text-mute"}`}>
              <span className="hidden font-mono text-dim sm:inline">{String(i + 1).padStart(2, "0")} </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
