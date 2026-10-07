export type EvidenceType = "url" | "image" | "pdf" | "github" | "text";

export type CheckKind = "automatic" | "ai";

export type Verdict = "pass" | "fail" | "review";

/** What the prototype's scripted verifier returns for a criterion. Replaced by the real verifier later. */
export type ScriptedResult = {
  verdict: Verdict;
  confidence: number;
  evidence: string;
  reason: string;
};

export type Criterion = {
  id: string;
  title: string;
  weight: number;
  mustPass: boolean;
  evidence: EvidenceType;
  check: CheckKind;
  /** Scripted outcomes for the dummy-data prototype: first attempt, then after a fix. The real checker ignores them. */
  demo?: { first: ScriptedResult; afterFix: ScriptedResult };
};

export type CriterionResult = ScriptedResult & { criterionId: string };

export type Report = {
  attempt: number;
  results: CriterionResult[];
  verifiedAt: string;
  reportHash: string;
};

export type LedgerEntry = {
  id: string;
  kind: "authorization" | "capture" | "void";
  amount: number;
  at: string;
  note: string;
};

export type MilestoneStatus =
  | "awaiting_funding"
  | "funded"
  | "verifying"
  | "awaiting_decision"
  | "fix_window"
  | "appealed"
  | "released"
  | "closed";

export type Submission = {
  url: string;
  prLink: string;
  files: string[];
  note: string;
  submittedAt: string;
};

/** Who approves releases after the report: the client, or the client's AI agent within its limits. */
export type ApprovalMode = "client" | "agent";

/** What the client's AI agent is allowed to do. The PayPal authorization stays the hard ceiling. */
export type AgentMandate = {
  name: string;
  owner: string;
  perMilestoneLimit: number;
  minConfidence: number;
  releaseVerified: boolean;
  fundMilestones: boolean;
};

export type AgentCheck = { label: string; detail: string; ok: boolean };

export type AgentDecision = {
  at: string;
  outcome: "released" | "handed_to_client";
  amount: number;
  checks: AgentCheck[];
};

/** One line of the checker's live log. The criterion lines carry their result. */
export type CheckLine = {
  at: string;
  verb: "open" | "shot" | "form" | "audit" | "carry" | "test" | "rubric" | "decide" | "sign" | "note";
  text: string;
  tone?: "good" | "bad" | "ai" | "money";
  criterionId?: string;
  result?: ScriptedResult;
};

/** Where money moves: the clickable prototype, a simulated PayPal, or the real PayPal sandbox. */
export type PayPalMode = "prototype" | "simulated" | "sandbox" | "live";

export type Milestone = {
  id: string;
  /** Short id people can read out ("M-1051"). Falls back to the id. */
  displayId?: string;
  title: string;
  brief?: string;
  clientName: string;
  clientEmail: string;
  freelancerName: string;
  freelancerLocation: string;
  boughtByAgent: boolean;
  amount: number;
  currency: "USD";
  reviewWindowHours: number;
  fixWindowHours: number;
  criteria: Criterion[];
  specHash: string;
  status: MilestoneStatus;
  createdAt: string;
  fundedAt?: string;
  decisionDueAt?: string;
  fixDueAt?: string;
  submission?: Submission;
  /** When the latest AI check started, so it can finish even if nobody is watching the page. */
  verifyStartedAt?: string;
  reports: Report[];
  ledger: LedgerEntry[];
  appealReason?: string;
  appealedAt?: string;
  approval: ApprovalMode;
  agentDecision?: AgentDecision;
  /** Created through the guided walkthrough, so the walkthrough card is shown on its pages. */
  walkthrough?: boolean;
  /** The checker's log for the latest attempt, written while it runs. */
  checks?: CheckLine[];
};

export type NewMilestoneInput = {
  title: string;
  brief?: string;
  clientName: string;
  clientEmail: string;
  freelancerName?: string;
  freelancerEmail?: string;
  freelancerLocation?: string;
  amount: number;
  reviewWindowHours: number;
  criteria: Omit<Criterion, "id">[];
};

/** Criteria drafted from a brief: by the AI, from a template (no AI set up), or by the prototype's script. */
export type CriteriaDraft = {
  source: "ai" | "template" | "prototype";
  template?: "website" | "logo" | "general";
  reason?: string;
  criteria: Omit<Criterion, "id">[];
};
