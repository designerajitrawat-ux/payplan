"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NumberTicker } from "@/components/motion";
import { createJourneyScene, ledgerAt, stationAt, STATIONS, type JourneyFonts, type JourneyScene, type ScreenRect } from "./journey-scene";

/** Share of the section's scroll spent on the arrival view, while the hero leaves and the camera lands. */
const INTRO = 0.16;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const storyAt = (r: number) => clamp01((r - INTRO) / (1 - INTRO));

/** The page's fonts as canvas font families, loaded before the billboards are drawn. */
async function loadFonts(): Promise<JourneyFonts> {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const fonts = { display: read("--font-headline", "sans-serif"), body: read("--font-body", "sans-serif"), mono: read("--font-code", "monospace") };
  await Promise.all([document.fonts.load(`700 64px ${fonts.display}`), document.fonts.load(`700 64px ${fonts.body}`), document.fonts.load(`500 32px ${fonts.mono}`)]).catch(() => undefined);
  return fonts;
}

/** Where each line of the hero's words and buttons sits on the canvas, in clip space, with a little air around it. */
function copyArea(copy: HTMLElement, canvas: HTMLCanvasElement): ScreenRect[] | undefined {
  const c = canvas.getBoundingClientRect();
  if (!c.width || !c.height) return undefined;
  const x = (px: number) => ((px - c.left) / c.width) * 2 - 1;
  const y = (px: number) => 1 - ((px - c.top) / c.height) * 2;
  const range = document.createRange();
  const walk = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const rects: ScreenRect[] = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent?.trim() || n.parentElement?.closest("[aria-hidden]")) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width) rects.push({ left: x(r.left - 32), right: x(r.right + 32), top: y(r.top - 20), bottom: y(r.bottom + 20) });
    }
  }
  return rects.length ? rects : undefined;
}

/**
 * The opening of the landing page: the hero sits over a 3D world seen from above, then scrolling lands the
 * camera on the road and walks one milestone through it: agree, lock on PayPal, AI check, partial release,
 * agent. Three.js loads only here. Without WebGL the hero, captions and numbers still tell the story.
 */
export function Journey({ intro }: { intro: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const [hud, setHud] = useState({ station: 0, held: 0, released: 0, started: false });
  const [ready, setReady] = useState(false);

  const heroOpacity = useTransform(scrollYProgress, [0, INTRO * 0.7], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, INTRO], [0, -90]);
  const heroEvents = useTransform(scrollYProgress, (v) => (v < INTRO * 0.4 ? "auto" : "none"));
  const hudOpacity = useTransform(scrollYProgress, [INTRO * 0.7, INTRO], [0, 1]);
  const hudEvents = useTransform(scrollYProgress, (v) => (v > INTRO * 0.7 ? "auto" : "none"));
  const rail = useTransform(scrollYProgress, [INTRO, 1], [0, 1]);

  useMotionValueEvent(scrollYProgress, "change", (r) => {
    const p = storyAt(r);
    const next = { station: stationAt(p), ...ledgerAt(p), started: r > 0.01 };
    setHud((h) => (h.station === next.station && h.held === next.held && h.released === next.released && h.started === next.started ? h : next));
  });

  useEffect(() => {
    const el = canvas.current;
    const host = section.current;
    if (!el || !host) return;
    let scene: JourneyScene | undefined;
    let raf = 0;
    let visible = false;
    let disposed = false;
    let progress = scrollYProgress.get();
    let clear: ScreenRect[] | undefined;
    const measure = () => {
      if (copy.current) clear = copyArea(copy.current, el);
    };
    const pointer = { x: 0, y: 0 };
    const aim = { x: 0, y: 0 };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();

    const loop = () => {
      raf = 0;
      if (!scene || !visible) return;
      // Ease towards the scroll position so wheel steps glide instead of jump.
      progress += (scrollYProgress.get() - progress) * (reduced ? 1 : 0.08);
      pointer.x += (aim.x - pointer.x) * 0.05;
      pointer.y += (aim.y - pointer.y) * 0.05;
      scene.frame(storyAt(progress), (performance.now() - t0) / 1000, pointer, 1 - clamp01(progress / INTRO), clear);
      raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!raf && visible && scene) raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        kick();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(host);
    const onMove = (e: PointerEvent) => {
      aim.x = (e.clientX / window.innerWidth) * 2 - 1;
      aim.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const ro = new ResizeObserver(() => {
      scene?.resize(el.clientWidth, el.clientHeight);
      measure();
    });
    ro.observe(el);
    // Measure again once the headline's words have risen into place.
    const settle = window.setTimeout(measure, 1600);

    void (async () => {
      try {
        const [three, fonts] = await Promise.all([import("three"), loadFonts()]);
        if (disposed) return;
        const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.25 : 1.75);
        scene = createJourneyScene(three, el, { fonts, reduced, dpr });
        scene.resize(el.clientWidth, el.clientHeight);
        measure();
        setReady(true);
        kick();
      } catch {
        // No WebGL: the blue backdrop, the hero and the captions carry the page.
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(settle);
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      scene?.dispose();
    };
  }, [scrollYProgress]);

  const st = STATIONS[hud.station];
  return (
    <section ref={section} aria-label="PayPlan: paid as agreed, then one milestone walked through in 3D" className="relative h-[460vh] bg-brand">
      <div className="sticky top-0 h-svh overflow-hidden">
        <canvas ref={canvas} aria-hidden className={`absolute inset-0 size-full transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`} />
        {/* The same light and grain as the other volt-blue surfaces, laid over the 3D world. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(120,146,255,0.32),transparent_55%),radial-gradient(110%_90%_at_100%_100%,rgba(10,26,160,0.35),transparent_60%)]" />
        <div aria-hidden className="film absolute inset-0" />

        <motion.div style={{ opacity: heroOpacity, y: heroY, pointerEvents: heroEvents }} className="absolute inset-0 z-10">
          {/* Behind the copy the world is dimmed, so it never competes with the text; the edges stay bright. */}
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_90%_58%_at_50%_48%,rgba(9,10,16,0.62),transparent_76%)] sm:bg-[radial-gradient(ellipse_58%_56%_at_50%_48%,rgba(9,10,16,0.58),transparent_76%)]" />
          <div ref={copy} className="relative flex h-full flex-col items-center justify-center px-4 pb-10 pt-16 text-center sm:px-6">
            {intro}
          </div>
        </motion.div>

        <ol className="sr-only">
          {STATIONS.map((s) => (
            <li key={s.title}>
              {s.title}: {s.caption}
            </li>
          ))}
        </ol>

        <motion.div style={{ opacity: hudOpacity, pointerEvents: hudEvents }} className="absolute inset-0">
          <div aria-hidden className="pointer-events-none absolute right-4 top-20 w-44 rounded-2xl border border-white/10 bg-paper-ink/90 p-3.5 text-white shadow-[0_5px_0_0_#000] sm:right-8 sm:top-24 sm:w-64 sm:p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">Milestone · $1,000</p>
            <div className="mt-2.5 flex items-baseline justify-between gap-2 sm:mt-3">
              <span className="text-[11px] text-white/75 sm:text-xs">Held on PayPal</span>
              <NumberTicker value={hud.held} duration={500} className="text-sm font-semibold text-ice sm:text-lg" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-white/75 sm:text-xs">Released to Ajit</span>
              <NumberTicker value={hud.released} duration={500} className="text-sm font-semibold text-mint sm:text-lg" />
            </div>
          </div>

          <div aria-hidden className="pointer-events-none absolute bottom-6 left-4 right-4 max-w-md sm:bottom-10 sm:left-8">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={hud.station}
                initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                className="rounded-2xl border border-white/10 bg-paper-ink/90 p-5 text-white shadow-[0_5px_0_0_#000]"
              >
                <p className="font-mono text-xs text-white/60">
                  <span className="text-white">{String(hud.station + 1).padStart(2, "0")}</span> / {String(STATIONS.length).padStart(2, "0")}
                </p>
                <p className="mt-2 font-display text-2xl font-bold uppercase tracking-[-0.02em] font-stretch-condensed sm:text-3xl">{st.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/80">{st.caption}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div aria-hidden className="absolute bottom-0 right-3 top-0 hidden w-px bg-white/25 sm:block">
            <motion.div className="h-full w-full origin-top bg-white" style={{ scaleY: rail }} />
          </div>

          <a href="#product" className="absolute left-4 top-20 rounded-full bg-paper-ink/60 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white backdrop-blur transition hover:bg-paper-ink/85 sm:bottom-10 sm:left-auto sm:right-8 sm:top-auto">
            Skip the tour ↓
          </a>
        </motion.div>

        <motion.p
          aria-hidden
          animate={{ opacity: hud.started ? 0 : 1, y: hud.started ? 12 : 0 }}
          className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-paper-ink/85 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white md:block"
        >
          Scroll to see a milestone get paid ↓
        </motion.p>
      </div>
    </section>
  );
}
