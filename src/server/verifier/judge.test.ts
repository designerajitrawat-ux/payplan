import { describe, expect, it } from "vitest";
import { CASES } from "./eval/cases";
import { createHybridJudge, type Judge, type JudgeInput } from "./judge";

const input = (id: string): JudgeInput => CASES.find((c) => c.id === id)!.input;

/** A stand-in for the AI that records what it was asked and always answers "review". */
function fakeAi() {
  const asked: string[] = [];
  const judge: Judge = {
    model: "fake-ai",
    async judge(i) {
      asked.push(i.criterion.title);
      return { verdict: "review", confidence: 0.5, evidence: "fake", reason: "fake" };
    },
  };
  return { judge, asked };
}

describe("hybrid judge", () => {
  it("lets the tools decide what they can measure, without asking the AI", async () => {
    const ai = fakeAi();
    const judge = createHybridJudge(ai.judge);
    expect((await judge.judge(input("function-form-works"))).verdict).toBe("pass");
    expect((await judge.judge(input("function-form-broken"))).verdict).toBe("fail");
    expect((await judge.judge(input("function-site-down"))).verdict).toBe("fail");
    expect((await judge.judge(input("function-http-only"))).verdict).toBe("fail");
    expect(ai.asked).toEqual([]);
  });

  it("sends judgement criteria straight to the AI", async () => {
    const ai = fakeAi();
    await createHybridJudge(ai.judge).judge(input("copy-exact"));
    expect(ai.asked).toHaveLength(1);
  });

  it("asks the AI about a measurable criterion the tools could not settle", async () => {
    const ai = fakeAi();
    const v = await createHybridJudge(ai.judge).judge(input("missing-mobile-audit"));
    expect(ai.asked).toHaveLength(1);
    expect(v.verdict).toBe("review");
  });

  it("reports the AI model as its name", () => {
    expect(createHybridJudge(fakeAi().judge).model).toBe("fake-ai");
  });
});
