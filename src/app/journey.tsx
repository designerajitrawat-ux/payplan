"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { NumberTicker } from "@/components/motion";
import { createJourneyScene, ledgerAt, stationAt, STATIONS, type JourneyFonts, type JourneyScene } from "./journey-scene";

/** The page's fonts as canvas font families, loaded before the billboards are drawn. */
async function loadFonts(): Promise<JourneyFonts> {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const fonts = { display: read("--font-headline", "sans-serif"), body: read("--font-body", "sans-serif"), mono: read("--font-code", "monospace") };
  await Promise.all([document.fonts.load(`700 64px ${fonts.display}`), document.fonts.load(`700 64px ${fonts.body}`), document.fonts.load(`500 32px ${fonts.mono}`)]).catch(() => undefined);
  return fonts;
}

/**
 * A scroll-driven 3D walk through one milestone: agree, lock on PayPal, AI check, partial release, agent.
 * Three.js loads only when this section is on the page. Without WebGL the captions and numbers still tell the story.
 */
export function Journey() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const [hud, setHud] = useState({ station: 0, held: 0, released: 0, started: false });
  const [failed, setFailed] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = { station: stationAt(p), ...ledgerAt(p), started: p > 0.015 };
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
      scene.frame(progress, (performance.now() - t0) / 1000, pointer);
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
    const ro = new ResizeObserver(() => scene?.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);

    void (async () => {
      try {
        const [three, fonts] = await Promise.all([import("three"), loadFonts()]);
        if (disposed) return;
        const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.25 : 1.75);
        scene = createJourneyScene(three, el, { fonts, reduced, dpr });
        scene.resize(el.clientWidth, el.clientHeight);
        kick();
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      scene?.dispose();
    };
  }, [scrollYProgress]);

  const st = STATIONS[hud.station];
  return (
    <section ref={section} aria-label="One milestone getting paid, as a 3D scene" className="relative h-[380vh] bg-brand">
      <div className="sticky top-0 h-svh overflow-hidden">
        <canvas ref={canvas} aria-hidden className={`absolute inset-0 size-full transition-opacity duration-700 ${failed ? "opacity-0" : ""}`} />

        <ol className="sr-only">
          {STATIONS.map((s) => (
            <li key={s.title}>
              {s.title}: {s.caption}
            </li>
          ))}
        </ol>

        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute right-4 top-20 w-44 rounded-2xl border border-white/10 bg-paper-ink/90 p-3.5 text-white shadow-[0_5px_0_0_#000] sm:right-8 sm:top-24 sm:w-64 sm:p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">Milestone · $1,000</p>
            <div className="mt-2.5 flex items-baseline justify-between gap-2 sm:mt-3">
              <span className="text-[11px] text-white/75 sm:text-xs">Held on PayPal</span>
              <NumberTicker value={hud.held} duration={500} className="text-sm font-semibold text-ice sm:text-lg" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-white/75 sm:text-xs">Released to Riya</span>
              <NumberTicker value={hud.released} duration={500} className="text-sm font-semibold text-mint sm:text-lg" />
            </div>
          </div>

          <div className="absolute bottom-6 left-4 right-4 max-w-md sm:bottom-10 sm:left-8">
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

          <div className="absolute bottom-0 right-3 top-0 hidden w-px bg-white/25 sm:block">
            <motion.div className="h-full w-full origin-top bg-white" style={{ scaleY: scrollYProgress }} />
          </div>
        </div>

        <motion.p
          aria-hidden
          animate={{ opacity: hud.started ? 0 : 1, y: hud.started ? 12 : 0 }}
          className="pointer-events-none absolute left-1/2 top-24 hidden -translate-x-1/2 rounded-full bg-paper-ink/85 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white lg:block"
        >
          Scroll to see a milestone get paid
        </motion.p>

        <a href="#product" className="absolute left-4 top-20 rounded-full bg-paper-ink/60 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white backdrop-blur transition hover:bg-paper-ink/85 sm:bottom-10 sm:left-auto sm:right-8 sm:top-auto">
          Skip the tour ↓
        </a>
      </div>
    </section>
  );
}
