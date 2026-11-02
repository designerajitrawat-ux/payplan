import { describe, expect, it } from "vitest";
import { z } from "zod";
import { chatJson, llmFromEnv, type LlmConfig } from "./llm";

const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };
const request = { system: "s", user: "u", schemaName: "x", jsonSchema: schema, parse: z.object({ ok: z.boolean() }), timeoutMs: 10_000 };

/** A fake AI service that answers with the given statuses in turn and records which model was asked. */
function service(statuses: number[]) {
  const models: string[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    models.push(JSON.parse(String(init.body)).model);
    const status = statuses[models.length - 1] ?? 200;
    return status === 200 ? Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }) : new Response("busy", { status });
  }) as unknown as typeof globalThis.fetch;
  const config: LlmConfig = { baseUrl: "https://ai.example/", apiKey: "k", model: "main", fallbackModel: "light", fetch };
  return { config, models };
}

describe("chatJson", () => {
  it("answers on the first try when the service is up", async () => {
    const s = service([200]);
    expect(await chatJson(s.config, request)).toEqual({ ok: true, data: { ok: true }, model: "main" });
    expect(s.models).toEqual(["main"]);
  });

  it("tries the main model again after a busy answer", async () => {
    const s = service([503, 200]);
    expect(await chatJson(s.config, request)).toMatchObject({ ok: true, model: "main" });
    expect(s.models).toEqual(["main", "main"]);
  });

  it("falls back to the lighter model when the main one stays busy", async () => {
    const s = service([503, 429, 200]);
    expect(await chatJson(s.config, request)).toMatchObject({ ok: true, model: "light" });
    expect(s.models).toEqual(["main", "main", "light"]);
  });

  it("gives up with the last reason when every try is busy", async () => {
    const s = service([503, 503, 503]);
    expect(await chatJson(s.config, request)).toEqual({ ok: false, reason: "The AI service answered 503" });
  });

  it("does not retry an answer that will not change, like a bad key", async () => {
    const s = service([401]);
    expect(await chatJson(s.config, request)).toEqual({ ok: false, reason: "The AI service answered 401" });
    expect(s.models).toEqual(["main"]);
  });
});

describe("llmFromEnv", () => {
  it("adds a light fallback model on Google's API only", () => {
    expect(llmFromEnv({ LLM_API_KEY: "k" })).toMatchObject({ model: "gemini-3.5-flash-lite", fallbackModel: "gemini-3.1-flash-lite" });
    expect(llmFromEnv({ LLM_API_KEY: "k", LLM_BASE_URL: "https://other.example/v1/" })?.fallbackModel).toBeUndefined();
    expect(llmFromEnv({ LLM_API_KEY: "k", LLM_BASE_URL: "https://other.example/v1/", LLM_FALLBACK_MODEL: "small" })?.fallbackModel).toBe("small");
    expect(llmFromEnv({})).toBeNull();
  });
});
