import { useSyncExternalStore } from "react";

// Routing for the static preview build. The route lives in memory and is mirrored to the URL hash
// ("#/m/m-1051/report") when the browser allows it, so the preview also works inside sandboxed frames.

const listeners = new Set<() => void>();

function readHash(): string {
  try {
    const hash = window.location.hash.slice(1);
    return hash.startsWith("/") ? hash : "/";
  } catch {
    return "/";
  }
}

let current = typeof window === "undefined" ? "/" : readHash();

function setCurrent(next: string) {
  if (next === current) return;
  current = next;
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  const sync = () => setCurrent(readHash());
  window.addEventListener("hashchange", sync);
  window.addEventListener("popstate", sync);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute() {
  const raw = useSyncExternalStore(
    subscribe,
    () => current,
    () => "/",
  );
  const [path, query = ""] = raw.split("?");
  return { raw, path: path || "/", query };
}

export function navigate(href: string, replace = false) {
  try {
    if (replace) window.history.replaceState(null, "", `#${href}`);
    else window.history.pushState(null, "", `#${href}`);
  } catch {
    // Some sandboxed frames refuse history updates; the in-memory route still changes.
  }
  setCurrent(href);
}
