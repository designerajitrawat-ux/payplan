// Evidence collectors: what the checker actually looked at. Everything here is untrusted input.

export type FormFact = { action: string; method: string; fields: string[] };

/** Facts read straight from the HTML, so the judge does not have to guess them from text. */
export type PageFacts = {
  https: boolean;
  viewportMeta: boolean;
  forms: FormFact[];
  /** Hex colours used in inline styles and style tags, most used first. */
  colors: string[];
  images: number;
  imagesWithoutAlt: number;
};

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
  facts: PageFacts;
};

export type MissingEvidence = { kind: "missing"; reason: string };

export type Evidence = PageEvidence | MissingEvidence;

/** A real test message sent through the page's form. */
export type FormTest = { action: string; status: number; ok: boolean; ms: number } | { action: string; error: string };

/** Google PageSpeed Insights, mobile: layout audits, a performance score and a screenshot. */
export type PageSpeed = { performance: number; viewport: boolean; contentWidth: boolean; screenshot?: string } | { unavailable: string };

export type CollectOptions = { fetch?: typeof fetch; now?: () => number; allowPrivate?: boolean };

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

function isHttpUrl(raw: string) {
  try {
    return ["http:", "https:"].includes(new URL(raw).protocol);
  } catch {
    return false;
  }
}

const allowed = (url: string, o: CollectOptions) => (o.allowPrivate ? isHttpUrl(url) : isPublicHttpUrl(url));

export function htmlToText(html: string): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const text = html
    .replace(/<(script|style|noscript|svg|template|title)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|h[1-6]|section|article|tr|label|button|a)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  return { title: title.slice(0, 200), text: text.slice(0, MAX_TEXT) };
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];

export function pageFacts(html: string, pageUrl: string): PageFacts {
  const forms = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].slice(0, 5).map(([, open, inner]) => {
    let action = pageUrl;
    try {
      action = new URL(attr(open, "action") || pageUrl, pageUrl).toString();
    } catch {
      // Keep the page URL when the action is not a valid URL.
    }
    const fields = [...inner.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)].map(([, , a]) => attr(a, "name")).filter((n): n is string => Boolean(n));
    return { action, method: (attr(open, "method") || "get").toLowerCase(), fields };
  });
  const styles = [...html.matchAll(/style\s*=\s*["']([^"']*)["']/gi)].map((m) => m[1]).join(" ") + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join(" ");
  const counts = new Map<string, number>();
  for (const [hex] of styles.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) counts.set(hex.toUpperCase(), (counts.get(hex.toUpperCase()) ?? 0) + 1);
  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)];
  return {
    https: pageUrl.startsWith("https:"),
    viewportMeta: /<meta[^>]+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i.test(html) || /<meta[^>]+content=["'][^"']*width=device-width[^"']*["'][^>]*name=["']viewport["']/i.test(html),
    forms,
    colors: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([hex]) => hex),
    images: imgs.length,
    imagesWithoutAlt: imgs.filter(([, a]) => attr(a, "alt") === undefined).length,
  };
}

export async function collectPage(url: string, deps: CollectOptions = {}): Promise<Evidence> {
  if (!url) return { kind: "missing", reason: "No URL was submitted" };
  if (!allowed(url, deps)) return { kind: "missing", reason: "The URL is not a public http(s) address" };
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
    const html = /html/.test(contentType);
    const { title, text } = html ? htmlToText(body) : { title: "", text: body.slice(0, MAX_TEXT) };
    const finalUrl = res.url || url;
    return { kind: "page", url, ok: res.ok, status: res.status, finalUrl, contentType, title, text, ms: now() - started, facts: pageFacts(html ? body : "", finalUrl) };
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "The URL did not answer within 10 seconds" : "The URL could not be reached";
    return { kind: "missing", reason };
  }
}

/** Fills the form with an obvious test message and sends it, the way a visitor would. */
export async function testForm(form: FormFact, deps: CollectOptions = {}): Promise<FormTest> {
  if (!allowed(form.action, deps)) return { action: form.action, error: "The form sends to an address that is not public" };
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const values = new URLSearchParams();
  for (const f of form.fields.length ? form.fields : ["name", "email", "message"]) {
    values.set(f, /mail/i.test(f) ? "acceptance-check@payplan.example" : /name/i.test(f) ? "PayPlan acceptance check" : /message|comment|body|text|question/i.test(f) ? "Automated acceptance test from PayPlan. Please ignore." : "test");
  }
  const started = now();
  try {
    const get = form.method === "get";
    const target = get ? `${form.action}${form.action.includes("?") ? "&" : "?"}${values}` : form.action;
    const res = await doFetch(target, {
      method: get ? "GET" : "POST",
      headers: get ? undefined : { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "PayPlanChecker/0.1 (+acceptance check)" },
      body: get ? undefined : values.toString(),
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return { action: form.action, status: res.status, ok: res.ok, ms: now() - started };
  } catch {
    return { action: form.action, error: "The form's address did not answer" };
  }
}

/** Mobile audit and screenshot from PageSpeed Insights. Needs a Google API key; public URLs only. */
export async function runPageSpeed(url: string, deps: { key?: string; fetch?: typeof fetch }): Promise<PageSpeed> {
  if (!deps.key) return { unavailable: "No PageSpeed API key is set on this server" };
  if (!isPublicHttpUrl(url)) return { unavailable: "PageSpeed can only check public URLs" };
  const doFetch = deps.fetch ?? fetch;
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${encodeURIComponent(deps.key)}`;
  try {
    const res = await doFetch(api, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) return { unavailable: `PageSpeed answered ${res.status}` };
    const body = (await res.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, { score?: number | null; details?: { data?: string } }> };
    };
    const audits = body.lighthouseResult?.audits ?? {};
    const shot = audits["final-screenshot"]?.details?.data;
    return {
      performance: Math.round((body.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      viewport: audits.viewport?.score === 1,
      contentWidth: audits["content-width"]?.score === 1,
      screenshot: shot?.startsWith("data:image/") ? shot : undefined,
    };
  } catch {
    return { unavailable: "PageSpeed did not answer in time" };
  }
}

/** Text an attacker might plant in delivered work to steer the checker. */
const STEERING = [/ignore (all |any )?(previous|prior|above) (instructions|rules)/i, /\b(system|assistant)\s*:/i, /(mark|rate|score|grade) (this|it|everything|all criteria) (as )?(pass|passed|100)/i, /verdict\s*[:=]\s*"?pass/i, /you are (now )?(an?|the) (ai|checker|judge|assistant)/i];

export function looksLikeSteering(text: string): boolean {
  return STEERING.some((re) => re.test(text));
}

export function describeEvidence(e: Evidence, extra: { form?: FormTest; pagespeed?: PageSpeed } = {}): string {
  if (e.kind === "missing") return `No evidence: ${e.reason}.`;
  const f = e.facts;
  const lines = [
    `URL: ${e.url}`,
    `HTTP status: ${e.status}${e.finalUrl !== e.url ? ` (after redirect to ${e.finalUrl})` : ""}`,
    `HTTPS: ${f.https ? "yes" : "no"}`,
    `Response time: ${e.ms} ms`,
    `Page title: ${e.title || "(none)"}`,
    `Mobile viewport tag: ${f.viewportMeta ? "present" : "missing"}`,
    `Forms: ${f.forms.length ? f.forms.map((x) => `${x.method.toUpperCase()} ${x.action} [${x.fields.join(", ")}]`).join("; ") : "none"}`,
    `Colours used: ${f.colors.join(", ") || "none found in inline styles"}`,
    `Images: ${f.images} (${f.imagesWithoutAlt} without alt text)`,
  ];
  if (extra.form) lines.push("error" in extra.form ? `Form test: ${extra.form.error}` : `Form test: sent a test message to ${extra.form.action}; it answered HTTP ${extra.form.status}`);
  if (extra.pagespeed) {
    const p = extra.pagespeed;
    lines.push("unavailable" in p ? `Mobile audit: not run (${p.unavailable})` : `Mobile audit (PageSpeed): performance ${p.performance}/100; viewport ${p.viewport ? "ok" : "failed"}; content fits the screen width ${p.contentWidth ? "yes" : "no"}`);
  }
  lines.push("Visible text:", e.text || "(empty)");
  return lines.join("\n");
}
