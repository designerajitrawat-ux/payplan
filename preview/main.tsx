import type { ComponentType } from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import AgentsPage from "@/app/agents/page";
import Dashboard from "@/app/dashboard/page";
import DecidePage from "@/app/m/[id]/decide/page";
import FundPage from "@/app/m/[id]/fund/page";
import MilestoneIndex from "@/app/m/[id]/page";
import ReportPage from "@/app/m/[id]/report/page";
import SubmitPage from "@/app/m/[id]/submit/page";
import VerifyPage from "@/app/m/[id]/verify/page";
import NewMilestonePage from "@/app/new/page";
import Home from "@/app/page";
import { Chrome } from "@/components/site-header";
import { useRoute } from "./router";

// Static preview of the prototype: the same pages as the Next.js app, routed by the URL hash.

const routes: [RegExp, ComponentType][] = [
  [/^\/$/, Home],
  [/^\/new$/, NewMilestonePage],
  [/^\/dashboard$/, Dashboard],
  [/^\/agents$/, AgentsPage],
  [/^\/m\/[^/]+$/, MilestoneIndex],
  [/^\/m\/[^/]+\/fund$/, FundPage],
  [/^\/m\/[^/]+\/submit$/, SubmitPage],
  [/^\/m\/[^/]+\/verify$/, VerifyPage],
  [/^\/m\/[^/]+\/report$/, ReportPage],
  [/^\/m\/[^/]+\/decide$/, DecidePage],
];

function NotFound() {
  return (
    <p className="text-mute">
      Page not found.{" "}
      <Link href="/" className="font-semibold text-nova underline">
        Go home
      </Link>
    </p>
  );
}

function App() {
  const { raw, path } = useRoute();
  const Page = routes.find(([pattern]) => pattern.test(path))?.[1] ?? NotFound;
  return (
    <Chrome>
      <Page key={raw} />
    </Chrome>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
