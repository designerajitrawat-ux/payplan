"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMilestoneId } from "@/components/milestone-shell";
import { useMilestone } from "@/lib/store";
import type { MilestoneStatus } from "@/lib/types";

const pageFor: Record<MilestoneStatus, string> = {
  awaiting_funding: "fund",
  funded: "submit",
  verifying: "verify",
  awaiting_decision: "report",
  appealed: "decide",
  fix_window: "report",
  released: "report",
  closed: "report",
};

/** Sends each milestone to the page that matches its current step. */
export default function MilestoneIndex() {
  const id = useMilestoneId();
  const m = useMilestone(id);
  const router = useRouter();
  useEffect(() => {
    router.replace(m ? `/m/${id}/${pageFor[m.status]}` : "/dashboard");
  }, [id, m, router]);
  return <p className="text-sm text-dim">Opening milestone…</p>;
}
