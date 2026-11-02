// One small client for any OpenAI-compatible chat API (Gemini through Google AI Studio by default).
// Every answer must match a JSON schema; anything else counts as "no answer".

import type { z } from "zod";

export type LlmConfig = { baseUrl: string; apiKey: string; model: string; fallbackModel?: string; fetch?: typeof fetch };

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type LlmResult<T> = { ok: true; data: T; model: string } | { ok: false; reason: string };

const GOOGLE = "https://generativelanguage.googleapis.com/v1beta/openai/";

export function llmFromEnv(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  if (!env.LLM_API_KEY) return null;
  const baseUrl = env.LLM_BASE_URL || GOOGLE;
  // The Flash-Lite models are fast and have the largest free daily quota (Flash has 20 requests a day).
  // Each model has its own quota, so on Google's API a second Flash-Lite stands in when the first is busy.
  const fallbackModel = env.LLM_FALLBACK_MODEL || (baseUrl.startsWith("https://generativelanguage.googleapis.com/") ? "gemini-3.1-flash-lite" : undefined);
  return { apiKey: env.LLM_API_KEY, baseUrl, model: env.LLM_MODEL || "gemini-3.5-flash-lite", fallbackModel };
}

// Busy or briefly broken: worth another try. Anything else (a bad key, a bad request) is not.
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export async function chatJson<S extends z.ZodType>(
  config: LlmConfig,
  request: { system: string; user: string | Part[]; schemaName: string; jsonSchema: Record<string, unknown>; parse: S; timeoutMs?: number },
): Promise<LlmResult<z.infer<S>>> {
  const doFetch = config.fetch ?? fetch;
  const deadline = Date.now() + (request.timeoutMs ?? 45_000);
  // The main model, the main model again after a short pause, then the fallback, all inside one time budget.
  const attempts = [config.model, config.model, ...(config.fallbackModel && config.fallbackModel !== config.model ? [config.fallbackModel] : [])];
  let reason = "The AI service did not answer";
  for (let i = 0; i < attempts.length; i++) {
    if (i === 1) await new Promise((r) => setTimeout(r, Math.min(800, Math.max(0, deadline - Date.now() - 2_000))));
    const left = deadline - Date.now();
    if (left < 1_500) break;
    try {
      const res = await doFetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(left),
        body: JSON.stringify({
          model: attempts[i],
          temperature: 0,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: { type: "json_schema", json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema } },
        }),
      });
      if (!res.ok) {
        reason = `The AI service answered ${res.status}`;
        if (RETRYABLE.has(res.status)) continue;
        return { ok: false, reason };
      }
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const json = (body.choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/)?.[0];
      const parsed = json ? request.parse.safeParse(JSON.parse(json)) : undefined;
      if (!parsed?.success) return { ok: false, reason: "The AI answer was not in the expected format" };
      return { ok: true, data: parsed.data, model: attempts[i] };
    } catch {
      reason = "The AI service did not answer";
    }
  }
  return { ok: false, reason };
}
