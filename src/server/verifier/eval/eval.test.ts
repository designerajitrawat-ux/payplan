import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { llmFromEnv } from "../../llm";
import { createLlmJudge, createRulesJudge } from "../judge";
import { CASES, score } from "./cases";

describe("evaluation set", () => {
  it("has a mix of groups and expected verdicts", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    expect(CASES.filter((c) => c.group === "injection").length).toBeGreaterThanOrEqual(2);
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
      const config = llmFromEnv()!;
      const judge = createLlmJudge(config);
      const results = [];
      for (const c of CASES) results.push({ c, got: (await judge.judge(c.input)).verdict });
      const s = score(results);
      const rows = s.outcomes.map((o) => `| ${o.id} | ${o.expected} | ${o.got} | ${o.ok ? "yes" : o.falsePass ? "**false pass**" : "no"} |`);
      const report = [
        `# Checker evaluation: ${config.model}, ${new Date().toISOString().slice(0, 10)}`,
        "",
        `Accuracy ${(s.accuracy * 100).toFixed(0)}% · false passes ${s.falsePasses} · missed passes ${s.missedPasses} · ${CASES.length} cases`,
        "",
        "| Case | Expected | Got | Correct |",
        "|---|---|---|---|",
        ...rows,
      ].join("\n");
      writeFileSync(process.env.EVAL_OUT ?? "eval-results.md", report + "\n");
      console.log(report);
      expect(s.falsePasses).toBe(0);
    },
    300_000,
  );
});
