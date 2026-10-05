"use client";

import { useState } from "react";
import { money } from "@/lib/format";

/**
 * Neutral stand-in for PayPal's checkout in the prototype. It deliberately does not copy PayPal's
 * look. In Phase 1 it is replaced by the official PayPal JS SDK button and a real sandbox AUTHORIZE order.
 */
export function PayPalMockButton({ amount, payerEmail, onApprove }: { amount: number; payerEmail: string; onApprove: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function approve() {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setOpen(false);
      onApprove();
    }, 900);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
      >
        Approve hold with PayPal
        <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold">simulated</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pp-title">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <p id="pp-title" className="font-semibold text-slate-900">
                Payment approval <span className="ml-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">simulated</span>
              </p>
              <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-700" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5 text-sm">
              <p className="text-slate-600">In the real app, PayPal&apos;s own checkout opens here and {payerEmail || "the client"} logs in.</p>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-slate-500">Authorization hold</p>
                <p className="text-2xl font-bold tabular-nums">{money(amount)}</p>
                <p className="mt-1 text-xs text-slate-500">Nothing is charged now. Only criteria that pass are captured later.</p>
              </div>
              <button onClick={approve} disabled={busy} className="w-full rounded-xl bg-teal-700 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                {busy ? "Approving…" : "Approve hold"}
              </button>
              <button onClick={() => setOpen(false)} className="w-full text-center text-slate-500 hover:text-slate-800">
                Cancel and return
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
