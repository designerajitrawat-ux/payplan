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

export function FlowSteps({ status }: { status: MilestoneStatus }) {
  const current = currentIndex[status];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold" aria-label="Milestone progress">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={state === "current" ? "step" : undefined}
              className={
                state === "done"
                  ? "rounded-full bg-teal-700 px-2.5 py-1 text-white"
                  : state === "current"
                    ? "rounded-full bg-teal-50 px-2.5 py-1 text-teal-800 ring-2 ring-teal-600"
                    : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-500"
              }
            >
              {i + 1}. {label}
            </span>
            {i < steps.length - 1 ? <span aria-hidden className="h-px w-3 bg-slate-300" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
