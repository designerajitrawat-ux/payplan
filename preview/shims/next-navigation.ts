import { useMemo } from "react";
import { navigate, useRoute } from "../router";

/** Stand-ins for next/navigation in the static preview, backed by the hash router. */

export function useRouter() {
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, true),
    back: () => window.history.back(),
    refresh: () => {},
    prefetch: () => {},
  };
}

export function useParams<T extends Record<string, string>>(): T {
  const { path } = useRoute();
  const match = path.match(/^\/m\/([^/]+)/);
  return (match ? { id: decodeURIComponent(match[1]) } : {}) as T;
}

export function useSearchParams(): URLSearchParams {
  const { query } = useRoute();
  return useMemo(() => new URLSearchParams(query), [query]);
}

export function usePathname(): string {
  return useRoute().path;
}
