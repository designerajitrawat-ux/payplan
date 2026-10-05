"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { money } from "@/lib/format";
import { Portal } from "./portal";
import { InfoTip } from "./ui";

type Phase = "idle" | "busy" | "done";

/**
 * Neutral stand-in for PayPal's checkout in the prototype. It deliberately does not copy PayPal's
 * look. In Phase 1 it is replaced by the official PayPal JS SDK button and a real sandbox AUTHORIZE order.
 */
export function PayPalMockButton({ amount, payerEmail, agentNote, onApprove }: { amount: number; payerEmail: string; agentNote?: string; onApprove: () => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog when it opens and back to the trigger when it closes.
  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Escape closes; Tab stays inside the dialog.
  function onDialogKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && phase === "idle") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function approve() {
    setPhase("busy");
    setTimeout(() => setPhase("done"), 900);
    setTimeout(() => {
      setOpen(false);
      setPhase("idle");
      onApprove();
    }, 1500);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="sheen group flex h-13 w-full items-center justify-center gap-2 rounded-full bg-sun px-5 font-semibold text-void shadow-[0_0_0_1px_rgba(255,197,61,0.5),0_12px_34px_-10px_rgba(255,197,61,0.7)] transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-2"
      >
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
          <rect x="4" y="9" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 9V6.5a3 3 0 016 0V9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        Approve hold with PayPal
        <span className="rounded-full bg-void/15 px-2 py-0.5 text-xs font-semibold">simulated</span>
      </button>
      <Portal>
        <AnimatePresence>
          {open ? (
            <motion.div
              key="dialog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              ref={dialogRef}
              onKeyDown={onDialogKey}
              className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pp-title"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
                className="glass w-full max-w-sm overflow-hidden rounded-3xl"
              >
                <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
                  <p id="pp-title" className="flex items-center gap-2 font-semibold text-ink">
                    Payment approval
                    <span className="rounded-full bg-sun/10 px-2 py-0.5 text-xs font-semibold text-sun ring-1 ring-inset ring-sun/25">simulated</span>
                  </p>
                  <button type="button" onClick={close} disabled={phase !== "idle"} className="rounded-md p-1.5 text-dim transition hover:bg-white/5 hover:text-ink" aria-label="Close">
                    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4 p-5 text-sm">
                  <p className="text-mute">In the real app, PayPal&apos;s own checkout opens here and {payerEmail || "the client"} logs in.</p>
                  <div className="rounded-2xl border border-ice/20 bg-ice/[0.06] p-4">
                    <p className="flex items-center gap-1 font-mono text-xs uppercase tracking-[0.16em] text-ice">
                      Authorization hold
                      <InfoTip label="Authorization hold">PayPal reserves the amount on your account without charging it. Only the share that passes is captured; whatever is left is released back to you.</InfoTip>
                    </p>
                    <p className="mt-1 font-sans text-3xl font-semibold text-ink font-stretch-semi-expanded">{money(amount)}</p>
                    <p className="mt-1 text-xs text-mute">Nothing is charged now. Only criteria that pass are captured later.</p>
                  </div>
                  {agentNote ? (
                    <p className="flex gap-2 rounded-2xl border border-nova/20 bg-nova/[0.06] p-3 text-xs text-mute">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-nova glow-dot" />
                      {agentNote}
                    </p>
                  ) : null}
                  <motion.button
                    ref={primaryRef}
                    type="button"
                    onClick={approve}
                    disabled={phase !== "idle"}
                    whileTap={{ scale: 0.97 }}
                    className={`relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full font-semibold transition-colors duration-500 ${phase === "done" ? "bg-mint text-void" : "bg-brand text-white hover:bg-[#3d6aff]"}`}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={phase}
                        initial={{ y: 18, opacity: 0, filter: "blur(4px)" }}
                        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                        exit={{ y: -18, opacity: 0, filter: "blur(4px)" }}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                        className="flex items-center gap-2"
                      >
                        {phase === "idle" ? "Approve hold" : null}
                        {phase === "busy" ? (
                          <>
                            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
                            Authorizing…
                          </>
                        ) : null}
                        {phase === "done" ? (
                          <>
                            <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                              <motion.path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.1 }} />
                            </svg>
                            Held
                          </>
                        ) : null}
                      </motion.span>
                  </AnimatePresence>
                </motion.button>
                <button type="button" onClick={close} disabled={phase !== "idle"} className="min-h-10 w-full rounded-full text-center text-dim transition hover:text-ink">
                  Cancel and return
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
        </AnimatePresence>
      </Portal>
    </>
  );
}
