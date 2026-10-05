import type { ComponentType } from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import Dashboard from "@/app/dashboard/page";
import DecidePage from "@/app/m/[id]/decide/page";
import FundPage from "@/app/m/[id]/fund/page";
import MilestoneIndex from "@/app/m/[id]/page";
import ReportPage from "@/app/m/[id]/report/page";
import SubmitPage from "@/app/m/[id]/submit/page";
import VerifyPage from "@/app/m/[id]/verify/page";
import NewMilestonePage from "@/app/new/page";
import Home from "@/app/page";
import { SiteHeader } from "@/components/site-header";
import { useRoute } from "./router";

// Static preview of the prototype: the same pages as the Next.js app, routed by the URL hash.

const routes: [RegExp, ComponentType][] = [
  [/^\/$/, Home],
  [/^\/new$/, NewMilestonePage],
  [/^\/dashboard$/, Dashboard],
  [/^\/m\/[^/]+$/, MilestoneIndex],
  [/^\/m\/[^/]+\/fund$/, FundPage],
  [/^\/m\/[^/]+\/submit$/, SubmitPage],
  [/^\/m\/[^/]+\/verify$/, VerifyPage],
  [/^\/m\/[^/]+\/report$/, ReportPage],
  [/^\/m\/[^/]+\/decide$/, DecidePage],
];

function NotFound() {
  return (
    <p className="text-slate-600">
      Page not found.{" "}
      <Link href="/" className="font-semibold text-teal-700 underline">
        Go home
      </Link>
    </p>
  );
}

function App() {
  const { raw, path } = useRoute();
  const Page = routes.find(([pattern]) => pattern.test(path))?.[1] ?? NotFound;
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-40 pt-8 sm:px-6">
        <Page key={raw} />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500 sm:px-6">
          Prototype with dummy data. No real payments are made. PayPal is a trademark of PayPal, Inc.; this project is not affiliated with PayPal.
        </p>
      </footer>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
