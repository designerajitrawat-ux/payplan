"use client";

import { useState } from "react";
import { money } from "@/lib/format";

/**
 * Stand-in for PayPal's checkout in the prototype. In Phase 1 this is replaced by the
 * official PayPal JS SDK button and a real sandbox AUTHORIZE order.
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
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FFC439] px-5 py-3 font-bold text-[#003087] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003087]"
      >
        Approve hold with PayPal
        <span className="text-xs font-semibold opacity-70">(sandbox mock)</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pp-title">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#003087] px-5 py-3 text-white">
              <p id="pp-title" className="font-bold italic">
                PayPal <span className="text-xs font-normal not-italic opacity-80">sandbox · simulated</span>
              </p>
              <button onClick={() => setOpen(false)} className="text-sm opacity-80 hover:opacity-100" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5 text-sm">
              <p className="text-slate-600">
                Logged in as <strong>{payerEmail || "client@example.com"}</strong>
              </p>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-slate-500">Authorization hold</p>
                <p className="text-2xl font-bold tabular-nums">{money(amount)}</p>
                <p className="mt-1 text-xs text-slate-500">Paid with PayPal balance. You are charged only for criteria that pass.</p>
              </div>
              <button onClick={approve} disabled={busy} className="w-full rounded-full bg-[#0070E0] py-3 font-semibold text-white hover:bg-[#005EA6] disabled:opacity-60">
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
