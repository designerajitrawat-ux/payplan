// Evidence collectors: what the checker actually looked at. Everything here is untrusted input.

export type PageEvidence = {
  kind: "page";
  url: string;
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  title: string;
  /** Visible text, tags stripped, capped so it fits in a prompt. */
  text: string;
  ms: number;
};

export type MissingEvidence = { kind: "missing"; reason: string };

export type Evidence = PageEvidence | MissingEvidence;

const MAX_BYTES = 1_000_000;
const MAX_TEXT = 6000;

/** Refuses addresses inside private networks, so a submitted URL cannot make the server probe them. */
export function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  // IPv6 literals: loopback, unique-local, link-local and IPv4-mapped addresses stay private.
  if (host.includes(":") && (host === "::1" || host === "::" || /^(fc|fd|fe80|::ffff:)/.test(host))) return false;
  return true;
}

export function htmlToText(html: string): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const text = html
    .replace(/<(script|style|noscript|svg|template|title)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|h[1-6]|section|article|tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  return { title: title.slice(0, 200), text: text.slice(0, MAX_TEXT) };
}

export async function collectPage(url: string, deps: { fetch?: typeof fetch; now?: () => number } = {}): Promise<Evidence> {
  if (!url) return { kind: "missing", reason: "No URL was submitted" };
  if (!isPublicHttpUrl(url)) return { kind: "missing", reason: "The URL is not a public http(s) address" };
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const started = now();
  try {
    const res = await doFetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "PayPlanChecker/0.1 (+acceptance check)", Accept: "text/html,*/*;q=0.8" } });
    const contentType = res.headers.get("content-type") ?? "";
    let body = "";
    if (/text|html|json|xml/.test(contentType) && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        body += decoder.decode(value, { stream: true });
        if (bytes > MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }
    const { title, text } = /html/.test(contentType) ? htmlToText(body) : { title: "", text: body.slice(0, MAX_TEXT) };
    return { kind: "page", url, ok: res.ok, status: res.status, finalUrl: res.url || url, contentType, title, text, ms: now() - started };
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "The URL did not answer within 10 seconds" : "The URL could not be reached";
    return { kind: "missing", reason };
  }
}

/** Text an attacker might plant in delivered work to steer the checker. */
const STEERING = [/ignore (all |any )?(previous|prior|above) (instructions|rules)/i, /\b(system|assistant)\s*:/i, /(mark|rate|score|grade) (this|it|everything|all criteria) (as )?(pass|passed|100)/i, /verdict\s*[:=]\s*"?pass/i, /you are (now )?(an?|the) (ai|checker|judge|assistant)/i];

export function looksLikeSteering(text: string): boolean {
  return STEERING.some((re) => re.test(text));
}

export function describeEvidence(e: Evidence): string {
  if (e.kind === "missing") return `No evidence: ${e.reason}.`;
  return [`URL: ${e.url}`, `HTTP status: ${e.status}${e.finalUrl !== e.url ? ` (after redirect to ${e.finalUrl})` : ""}`, `Response time: ${e.ms} ms`, `Content type: ${e.contentType || "unknown"}`, `Page title: ${e.title || "(none)"}`, "Visible text:", e.text || "(empty)"].join("\n");
}
