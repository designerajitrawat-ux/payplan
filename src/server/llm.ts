// One small client for any OpenAI-compatible chat API (Gemini through Google AI Studio by default).
// Every answer must match a JSON schema; anything else counts as "no answer".

import type { z } from "zod";

export type LlmConfig = { baseUrl: string; apiKey: string; model: string; fetch?: typeof fetch };

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type LlmResult<T> = { ok: true; data: T } | { ok: false; reason: string };

export function llmFromEnv(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  if (!env.LLM_API_KEY) return null;
  return { apiKey: env.LLM_API_KEY, baseUrl: env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/", model: env.LLM_MODEL || "gemini-3.5-flash" };
}

export async function chatJson<S extends z.ZodType>(
  config: LlmConfig,
  request: { system: string; user: string | Part[]; schemaName: string; jsonSchema: Record<string, unknown>; parse: S; timeoutMs?: number },
): Promise<LlmResult<z.infer<S>>> {
  const doFetch = config.fetch ?? fetch;
  try {
    const res = await doFetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(request.timeoutMs ?? 45_000),
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        response_format: { type: "json_schema", json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema } },
      }),
    });
    if (!res.ok) return { ok: false, reason: `The AI service answered ${res.status}` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const json = (body.choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/)?.[0];
    const parsed = json ? request.parse.safeParse(JSON.parse(json)) : undefined;
    if (!parsed?.success) return { ok: false, reason: "The AI answer was not in the expected format" };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, reason: "The AI service did not answer" };
  }
}
