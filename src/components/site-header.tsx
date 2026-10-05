"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetDemo } from "@/lib/store";

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-teal-700" />
        <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-slate-900">PayPlan</span>
    </span>
  );
}

export function SiteHeader() {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="PayPlan home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium text-slate-600">
            <Link href="/dashboard" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
              Milestones
            </Link>
            <Link href="/new" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
              New milestone
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">Prototype · dummy data</span>
          <button
            onClick={() => {
              resetDemo();
              router.push("/");
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            Reset demo
          </button>
        </div>
      </div>
    </header>
  );
}
