import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { llmFromEnv } from "../../llm";
import { createHybridJudge, createLlmJudge, createRulesJudge, type Judge, type Verdict } from "../judge";
import { CASES, score, type EvalCase } from "./cases";

// The published results sit next to the plan in the app's docs/ folder.
const RESULTS = new URL("../../../../docs/eval-results.md", import.meta.url);

describe("evaluation set", () => {
  it("has a mix of groups and expected verdicts", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(32);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    expect(CASES.filter((c) => c.group === "injection").length).toBeGreaterThanOrEqual(8);
    // A set that is mostly "fail" would reward a checker that fails everything.
    for (const v of ["pass", "fail", "review"] as const) expect(CASES.filter((c) => c.expected === v).length, v).toBeGreaterThanOrEqual(8);
    expect(CASES.filter((c) => c.expected === "fail").length).toBeLessThan(CASES.length / 2);
  });

  it("the rules judge (no AI key) never passes work that should not pass", async () => {
    const rules = createRulesJudge();
    const results = await Promise.all(CASES.map(async (c) => ({ c, got: (await rules.judge(c.input)).verdict })));
    const s = score(results);
    expect(s.falsePasses).toBe(0);
    // Everything it can decide with a plain test, it decides correctly.
    for (const { c, got } of results) if (c.group === "function") expect(got, c.id).toBe(c.expected);
  });

  // Runs the real AI judge on every case: EVAL_LIVE=1 LLM_API_KEY=... npm test -- eval
  it.runIf(process.env.EVAL_LIVE === "1" && Boolean(process.env.LLM_API_KEY))(
    "the AI judge: accuracy and false passes",
    async () => {
      // Counts which model gave each answer and how often the service was busy, so the report says so.
      const answered = new Map<string, number>();
      let busy = 0;
      const counting: typeof fetch = async (url, init) => {
        const res = await fetch(url, init);
        const model = String(JSON.parse(String(init?.body ?? "{}")).model);
        if (res.ok) answered.set(model, (answered.get(model) ?? 0) + 1);
        else busy++;
        return res;
      };
      const config = { ...llmFromEnv()!, fetch: counting };
      // Free tiers allow about 15 requests a minute, so AI calls are spaced out.
      const pause = Number(process.env.EVAL_PAUSE_MS ?? 4500);
      const ai = createLlmJudge(config);
      let calls = 0;
      const paced: Judge = {
        model: ai.model,
        async judge(input) {
          if (calls++) await new Promise((r) => setTimeout(r, pause));
          return ai.judge(input);
        },
      };
      // The same judge the app uses: tools first for measurable criteria, then the AI.
      const judge = createHybridJudge(paced);
      const results: { c: EvalCase; got: Verdict["verdict"]; v: Verdict }[] = [];
      for (const c of CASES) {
        const v = await judge.judge(c.input);
        results.push({ c, got: v.verdict, v });
      }
      const s = score(results);
      const count = (v: string) => CASES.filter((c) => c.expected === v).length;
      const unavailable = results.filter((r) => r.v.evidence === "AI check not completed").length;
      const models = [...answered.entries()].map(([m, n]) => `${n} from ${m}`).join(", ") || "none";
      const rows = s.outcomes.map((o) => `| ${o.id} | ${o.expected} | ${o.got} | ${o.ok ? "yes" : o.falsePass ? "**false pass**" : "no"} |`);
      const wrong = results.filter((_, i) => !s.outcomes[i].ok).map((r) => `- ${r.c.id} (expected ${r.c.expected}, got ${r.got}): ${r.v.reason}`);
      const report = [
        "> Live run of the app's checker (tools first for measurable criteria, then the AI) on the labelled set in `web/src/server/verifier/eval/cases.ts`. Reproduce with `EVAL_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run eval` in `web/`.",
        "",
        `# Checker evaluation: ${config.model}, ${new Date().toISOString().slice(0, 10)}`,
        "",
        `Accuracy ${(s.accuracy * 100).toFixed(0)}% · false passes ${s.falsePasses} · missed passes ${s.missedPasses} · ${CASES.length} cases (expected: ${count("pass")} pass, ${count("fail")} fail, ${count("review")} review)`,
        "",
        `By group: ${s.groups.map((g) => `${g.group} ${g.correct}/${g.cases}${g.falsePasses ? ` (${g.falsePasses} false pass${g.falsePasses > 1 ? "es" : ""})` : ""}`).join(" · ")}`,
        "",
        `AI answers: ${models}; busy answers retried: ${busy}; cases the AI could not answer: ${unavailable}. Tools alone decided ${CASES.length - calls} cases.`,
        "",
        "| Case | Expected | Got | Correct |",
        "|---|---|---|---|",
        ...rows,
        ...(wrong.length ? ["", "Wrong answers, with the checker's own reason:", "", ...wrong] : []),
      ].join("\n");
      writeFileSync(process.env.EVAL_OUT ?? RESULTS, report + "\n");
      console.log(report);
      expect(s.falsePasses).toBe(0);
    },
    900_000,
  );
});
