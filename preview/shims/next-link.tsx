import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { navigate } from "../router";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; children?: ReactNode };

/** Stand-in for next/link in the static preview: internal links become hash routes. */
export default function Link({ href, prefetch, children, onClick, ...anchor }: LinkProps) {
  void prefetch;
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    navigate(href);
  };
  return (
    <a href={`#${href}`} onClick={handleClick} {...anchor}>
      {children}
    </a>
  );
}
