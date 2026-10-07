import { describe, expect, it } from "vitest";
import { draftCriteria, DRAFT_PROMPT, normalizeWeights } from "./draft";

const brief = 'Landing page for Northwind. Headline "Know where every rupee goes". Working contact form.';

function llm(content: string) {
  const bodies: Record<string, unknown>[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return Response.json({ choices: [{ message: { content } }] });
  }) as unknown as typeof globalThis.fetch;
  return { bodies, config: { baseUrl: "https://ai.example/", apiKey: "k", model: "gemini-2.5-flash", fetch } };
}

describe("draftCriteria", () => {
  it("labels a template as a template when there is no AI key", async () => {
    const d = await draftCriteria(brief, null);
    expect(d).toMatchObject({ source: "template", template: "website", reason: "AI drafting is not set up on this server" });
    expect(d.criteria.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });

  it("uses the AI's criteria, fixes the weights to 100 and allows at most two gates", async () => {
    const { config, bodies } = llm(
      JSON.stringify({
        criteria: [
          { title: "Page is live over HTTPS", weight: 30, mustPass: true, evidence: "url", check: "automatic" },
          { title: 'Hero says "Know where every rupee goes"', weight: 30, mustPass: true, evidence: "url", check: "ai" },
          { title: "Contact form sends a message", weight: 30, mustPass: true, evidence: "url", check: "automatic" },
        ],
      }),
    );
    const d = await draftCriteria(brief, config);
    expect(d.source).toBe("ai");
    expect(d.criteria.map((c) => c.weight)).toEqual([34, 33, 33]);
    expect(d.criteria.filter((c) => c.mustPass)).toHaveLength(2);
    const messages = bodies[0].messages as { content: string }[];
    expect(messages[0].content).toBe(DRAFT_PROMPT);
    expect(messages[1].content).toContain("<brief>");
  });

  it("falls back to a labelled template when the AI answer is unusable", async () => {
    const d = await draftCriteria(brief, llm("no idea").config);
    expect(d).toMatchObject({ source: "template", reason: "The AI answer was not in the expected format" });
  });
});

describe("normalizeWeights", () => {
  it("keeps proportions and always totals 100", () => {
    expect(normalizeWeights([1, 1, 1])).toEqual([34, 33, 33]);
    expect(normalizeWeights([50, 30, 30])).toEqual([46, 27, 27]);
    expect(normalizeWeights([0, 0])).toEqual([50, 50]);
  });
});
