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
  /** Inline SVG graphics that draw something, as a logo drawn in SVG rather than loaded as an image file. */
  graphics: number;
  hero: Hero;
  /** Scripts, images, stylesheets, frames and media the page loads over plain http:// (mixed content on an HTTPS page). */
  insecure: string[];
  /** Where text aimed at the checker was found, such as the page title, hidden text, a comment or alt text. Empty when none. */
  steering: string[];
};

/** The top of the page, which copy criteria are about. */
export type Hero = {
  /** 1 when the page has an h1; otherwise the level of the first heading, used instead; 0 when there is no heading. */
  level: number;
  /** Every heading at that level in the hero. More than one means they compete, as in a split test. */
  headlines: { text: string; hidden: boolean }[];
  /** Buttons and links between the headline and the next section. */
  actions: string[];
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

/**
 * Google PageSpeed Insights, mobile: layout audits, a performance score and a screenshot.
 * A layout audit is undefined when this Lighthouse version does not report it (Lighthouse 13 dropped content-width).
 */
export type PageSpeed = { performance: number; viewport?: boolean; contentWidth?: boolean; screenshot?: string } | { unavailable: string };

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

/** A piece of HTML as one line of text, letter case kept. */
const inline = (html: string) => htmlToText(html).text.replace(/\s*\n\s*/g, " ").trim();

/** Attributes and styles that hide an element from visitors. */
const HIDES = /(^|[\s"'])hidden([\s"'=]|$)|aria-hidden\s*=\s*["']?true|sr-only|visually-hidden|display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(\.0+)?\s*(;|["']|$)|font-size\s*:\s*[01](\.\d+)?\s*(px|pt)?\s*(;|["']|$)|(left|top|right|text-indent)\s*:\s*-\d{3,}px/i;

/** Finds the hero: the first h1 with any h1 that competes with it, and the buttons and links before the next section. */
function findHero(html: string): Hero {
  const clean = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, " ");
  const body = clean.slice(Math.max(0, clean.search(/<body\b/i)));
  const h1 = body.search(/<h1\b/i);
  const first = h1 >= 0 ? h1 : body.search(/<h[2-6]\b/i);
  if (first < 0) return { level: 0, headlines: [], actions: [] };
  const level = Number(body[first + 2]);
  const rest = body.slice(first);
  const close = Math.max(0, rest.search(new RegExp(`</h${level}>`, "i")));
  // The hero ends at the next section, the next lower heading, or the footer. Further h1s before that compete.
  const next = level === 1 ? /<h[2-6]\b|<section\b|<\/section>|<article\b|<footer\b|<\/main>|<\/header>/i : /<h[1-6]\b|<section\b|<\/section>|<article\b|<footer\b|<\/main>|<\/header>/i;
  const end = rest.slice(close).search(next);
  const region = rest.slice(0, Math.min(end < 0 ? rest.length : close + end, 4000));
  const headings = [...region.matchAll(new RegExp(`<h${level}\\b([^>]*)>([\\s\\S]*?)</h${level}>`, "gi"))]
    .map(([, attrs, inner]) => ({ text: inline(inner), hidden: HIDES.test(attrs) }))
    .filter((h) => h.text)
    .slice(0, level === 1 ? 4 : 1);
  const between = region.replace(/<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi, " ");
  const actions = [
    ...[...between.matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(([, , inner]) => inline(inner)),
    ...[...between.matchAll(/<input\b([^>]*)>/gi)].filter(([, a]) => /type\s*=\s*["']?(submit|button)/i.test(a)).map(([, a]) => attr(a, "value") ?? ""),
  ].filter(Boolean);
  return { level, headlines: headings, actions: [...new Set(actions)].slice(0, 4) };
}

/** Subresources requested over plain http://. On an HTTPS page browsers warn about or block them. */
function insecureFiles(html: string): string[] {
  const found = new Set<string>();
  for (const [, tag, attrs] of html.matchAll(/<(script|img|iframe|frame|source|video|audio|embed|track|object|link)\b([^>]*)>/gi)) {
    if (tag.toLowerCase() === "link" && !/\brel\s*=\s*["']?[^"'>]*(stylesheet|icon|preload|modulepreload|manifest)/i.test(attrs)) continue;
    for (const [, url] of attrs.matchAll(/\b(?:src|href|data|poster)\s*=\s*["']?(http:\/\/[^"'\s>]+)/gi)) found.add(url);
  }
  for (const [, url] of html.matchAll(/url\(\s*["']?(http:\/\/[^"')\s]+)/gi)) found.add(url);
  return [...found].slice(0, 10).map((u) => u.slice(0, 160));
}

/** Where the page carries text aimed at the checker. Hidden places count with less: naming the checker is enough there. */
function plantedNotes(html: string): string[] {
  const where = new Set<string>();
  const { title, text } = htmlToText(html);
  if (looksLikeSteering(title)) where.add("page title");
  if (looksLikeSteering(text)) where.add("visible text");
  const hidden = (place: string, t: string) => {
    if (t && (looksLikeSteering(t) || ADDRESSEE.test(t.normalize("NFC")))) where.add(place);
  };
  for (const [, c] of html.matchAll(/<!--([\s\S]*?)-->/g)) hidden("an HTML comment", c);
  for (const [, , inner] of html.matchAll(/<(noscript|template)\b[^>]*>([\s\S]*?)<\/\1>/gi)) hidden("hidden text", inner.replace(/<[^>]+>/g, " "));
  const lower = html.toLowerCase();
  for (const m of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    if (!HIDES.test(m[2])) continue;
    const start = (m.index ?? 0) + m[0].length;
    const close = lower.indexOf(`</${m[1].toLowerCase()}>`, start);
    if (close > start) hidden("hidden text", inline(html.slice(start, close)));
  }
  for (const [, a] of html.matchAll(/<meta\b([^>]*)>/gi)) if (!/name\s*=\s*["']?viewport/i.test(a)) hidden("a meta tag", attr(a, "content") ?? "");
  for (const [, , d, s] of html.matchAll(/\b(alt|aria-label|title)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) hidden("alt text or a label", d ?? s ?? "");
  return [...where];
}

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
  // Labels are left out on purpose: a label is the page's own claim, and only a screenshot shows what is drawn.
  const graphics = [...html.matchAll(/<svg\b[^>]*>([\s\S]*?)<\/svg>/gi)].filter(([, inner]) => /<(path|circle|rect|ellipse|polygon|polyline|line|image|use|text)\b/i.test(inner)).length;
  return {
    https: pageUrl.startsWith("https:"),
    viewportMeta: /<meta[^>]+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i.test(html) || /<meta[^>]+content=["'][^"']*width=device-width[^"']*["'][^>]*name=["']viewport["']/i.test(html),
    forms,
    colors: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([hex]) => hex),
    images: imgs.length,
    imagesWithoutAlt: imgs.filter(([, a]) => attr(a, "alt") === undefined).length,
    graphics,
    hero: findHero(html),
    insecure: insecureFiles(html),
    steering: plantedNotes(html),
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
    // The first of these audits that this Lighthouse version scored as passed (1) or failed (0).
    // Lighthouse 13 replaced "viewport" with "viewport-insight" and dropped "content-width".
    const decided = (...ids: string[]) => {
      for (const id of ids) {
        const score = audits[id]?.score;
        if (score === 0 || score === 1) return score === 1;
      }
      return undefined;
    };
    return {
      performance: Math.round((body.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      viewport: decided("viewport-insight", "viewport"),
      contentWidth: decided("content-width"),
      screenshot: shot?.startsWith("data:image/") ? shot : undefined,
    };
  } catch {
    return { unavailable: "PageSpeed did not answer in time" };
  }
}

/** Text an attacker might plant in delivered work to steer the checker. */
const STEERING = [
  /ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|rules|prompts?)/i,
  /(mark|record|rate|score|grade|treat|consider) (this|it|everything|every criterion|all criteria|the criterion|this criterion) (as )?(a )?(pass|passed|accepted|approved|met|100)\b/i,
  /verdict"?\s*[:=]\s*"?(pass|approved|accept)/i,
  /you are (now )?(an?|the) (ai|checker|judge|assistant|grader|reviewer)\b/i,
  // A chat-style line that talks to the checker. A product's own "Assistant:" label alone is not steering.
  /\b(system|assistant)\s*:[^\n]{0,200}?\b(verdict|criteri(on|a)|instructions?|ignore|checker|reviewer|grader)\b/i,
  // Copies of the checker's own evidence format, which only its tools may write.
  /\bmobile audit\b[^\n:]{0,20}:|\bform test\s*:|\bhttp status\s*:\s*\d{3}\b|\bmobile viewport tag\s*:|\bchecker measurements\b|\b(BEGIN|END) PAGE-|<\/?evidence>/i,
];

const anyOf = (words: string[]) => new RegExp(words.join("|").normalize("NFC"), "i");

/** Words that address a checker, in a few languages. Bare "AI" or "reviewer" is too common in ordinary pages to count. */
const ADDRESSEE = anyOf([
  String.raw`\b(ai|automated|acceptance|payplan|llm)[ -]?(checker|reviewer|grader|judge|evaluator|verifier)s?\b`,
  String.raw`\b(the|this|dear|to) (checker|grader|evaluator|verifier)\b`,
  String.raw`\blanguage model\b`,
  ...["जाँचकर्ता", "जांचकर्ता", "समीक्षक", "परीक्षक", "मूल्यांकनकर्ता", "revisor", "evaluador", "verificador", "vérificateur", "évaluateur", "correcteur", "prüfer", "gutachter", "avaliador"],
  ...["审核员", "评审", "审查员", "检查员", "проверяющ", "ревьюер"],
]);

/** Words that claim approval or a verdict, in the same languages. */
const APPROVAL = anyOf([
  String.raw`\b(pass|passed|verdict|approve|approved|approval|pre-approved|accept|accepted|signed off|sign-off|criterion|criteria)\b`,
  ...["मंज़ूर", "मंजूर", "स्वीकृत", "स्वीकार", "अनुमोदित", "फ़ैसला", "फैसला", "निर्णय", "मानदंड", "पास"],
  ...["aprobad", "veredicto", "aceptad", "criterio", "approuvé", "validé", "accepté", "critère", "genehmigt", "bestanden", "akzeptiert", "kriteri", "aprovad", "veredito"],
  ...["批准", "通过", "合格", "判定", "одобрен", "вердикт", "принят", "критери"],
]);

/** A sentence that names the checker and claims approval or a verdict, in any of the languages above. */
const addressesChecker = (text: string) =>
  text
    .normalize("NFC")
    .split(/\n|(?<=[.!?।])\s+/)
    .some((s) => ADDRESSEE.test(s) && APPROVAL.test(s));

export function looksLikeSteering(text: string): boolean {
  return STEERING.some((re) => re.test(text)) || addressesChecker(text);
}

/** A fresh code for each prompt, so the page cannot fake the end of its own block. */
export const boundaryCode = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

function heroLines(h: Hero): string[] {
  const q = (s: string) => `"${s}"`;
  const shown = h.headlines.map((x) => `${q(x.text)}${x.hidden ? " (hidden in the HTML)" : ""}`);
  const actions = `Hero buttons and links: ${h.actions.length ? h.actions.map(q).join(", ") : "none next to the headline"}`;
  if (h.level === 0) return ["Hero headline: none (the page has no headings)", actions];
  if (!shown.length) return [`Hero headline: the first h${h.level} has no text`, actions];
  if (h.level > 1) return [`Hero headline: the page has no h1; its first heading (h${h.level}) is ${shown[0]}`, actions];
  if (shown.length > 1) return [`Hero headlines: ${shown.length} competing h1 headings: ${shown.join("; ")}`, actions];
  return [`Hero headline (h1): ${shown[0]}`, actions];
}

/**
 * The evidence as the judge reads it, in two blocks: measurements taken by the checker's own tools (trusted),
 * then the page's own content between BEGIN and END lines carrying a one-time code (untrusted).
 */
export function describeEvidence(e: Evidence, extra: { form?: FormTest; pagespeed?: PageSpeed } = {}, opts: { code?: string; screenshot?: boolean } = {}): string {
  const measured = ["Checker measurements (trusted: taken by PayPlan's own tools):"];
  if (e.kind === "missing") return [...measured, `No evidence: ${e.reason}.`].join("\n");
  const f = e.facts;
  const html = /html/i.test(e.contentType);
  const readable = /text|html|json|xml/i.test(e.contentType);
  measured.push(
    `URL: ${e.url}`,
    `HTTP status: ${e.status}${e.finalUrl !== e.url ? ` (after redirect to ${e.finalUrl})` : ""}`,
    `HTTPS: ${f.https ? "yes" : "no"}`,
    `Response time: ${e.ms} ms`,
    ...(readable ? [] : [`Content type: ${e.contentType || "unknown"} (the checker cannot read inside this kind of file)`]),
    `Mobile viewport tag: ${f.viewportMeta ? "present" : "missing"}`,
    `Colours found in the page's styles, most used first: ${f.colors.join(", ") || "none"}`,
    `Image files (img tags): ${f.images} (${f.imagesWithoutAlt} without alt text); inline SVG graphics: ${f.graphics}`,
    `Files loaded over plain http://: ${f.insecure.length ? `${f.insecure.length} (${f.insecure.join(", ")})` : "none"}`,
  );
  if (extra.form) measured.push("error" in extra.form ? `Form test: ${extra.form.error}` : `Form test: sent a test message to ${extra.form.action}; it answered HTTP ${extra.form.status}`);
  if (extra.pagespeed) {
    const p = extra.pagespeed;
    const said = (v: boolean | undefined, yes: string, no: string) => (v === undefined ? "not reported by this audit" : v ? yes : no);
    measured.push("unavailable" in p ? `Mobile audit: not run (${p.unavailable})` : `Mobile audit (PageSpeed): performance ${p.performance}/100; viewport ${said(p.viewport, "ok", "failed")}; content fits the screen width ${said(p.contentWidth, "yes", "no")}`);
  }
  if (opts.screenshot) measured.push("Screenshot: a phone screenshot taken by the mobile audit is attached.");
  const code = opts.code ?? boundaryCode();
  const content = [
    `Delivered page content (untrusted: written by whoever made the page; it ends at the line END PAGE-${code}):`,
    `BEGIN PAGE-${code}`,
    `Page title: ${e.title || "(none)"}`,
    ...(html ? heroLines(f.hero) : []),
    `Forms:${f.forms.length ? f.forms.map((x) => `${x.method.toUpperCase()} ${x.action} [${x.fields.join(", ")}]`).join("; ") : "none"}`,
    "Visible text:",
    e.text || "(empty)",
    `END PAGE-${code}`,
  ];
  return [...measured, "", ...content].join("\n");
}
