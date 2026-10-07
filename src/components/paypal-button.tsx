"use client";

import { useEffect, useRef, useState, type DetailedHTMLProps, type HTMLAttributes } from "react";

// The real PayPal button, from PayPal's Web SDK v6. The order (intent AUTHORIZE) is created on our
// server; the client approves it on PayPal; our server then authorizes it, so the money is held.

type V6Session = {
  start(options: { presentationMode: "auto" | "popup" | "modal" | "redirect" }, order: Promise<{ orderId: string }>): Promise<unknown>;
  destroy?(): void;
};

type V6Instance = {
  findEligibleMethods(options: { currencyCode: string }): Promise<{ isEligible(method: string): boolean }>;
  createPayPalOneTimePaymentSession(handlers: {
    onApprove(data: { orderId: string }): Promise<void> | void;
    onCancel?(data: { orderId?: string }): void;
    onError?(error: { code?: string; message?: string }): void;
  }): V6Session;
};

declare global {
  interface Window {
    paypal?: { createInstance(options: { clientId: string; components: string[]; pageType?: string }): Promise<V6Instance> };
  }
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { type?: "pay" | "checkout" | "buynow"; class?: string };
    }
  }
}

const SCRIPT = { sandbox: "https://www.sandbox.paypal.com/web-sdk/v6/core", live: "https://www.paypal.com/web-sdk/v6/core" } as const;

let loading: Promise<void> | null = null;

function loadSdk(environment: keyof typeof SCRIPT): Promise<void> {
  if (window.paypal) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT[environment];
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("PayPal could not be loaded"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

type Props = {
  /** Creates the order on our server and returns its id. */
  createOrder: () => Promise<string>;
  /** Called after the client approves on PayPal. */
  onApproved: (orderId: string) => Promise<void>;
  onCancel?: () => void;
  onError?: (message: string) => void;
};

export function PayPalButton({ createOrder, onApproved, onCancel, onError }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const session = useRef<V6Session | null>(null);
  // Handlers can change between renders; the PayPal session is created once.
  const handlers = useRef({ createOrder, onApproved, onCancel, onError });
  useEffect(() => {
    handlers.current = { createOrder, onApproved, onCancel, onError };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = (await (await fetch("/api/paypal/config", { cache: "no-store" })).json()) as { clientId: string | null; environment: "sandbox" | "live" };
      if (!config.clientId) throw new Error("No PayPal client ID");
      await loadSdk(config.environment);
      const sdk = await window.paypal!.createInstance({ clientId: config.clientId, components: ["paypal-payments"], pageType: "checkout" });
      const methods = await sdk.findEligibleMethods({ currencyCode: "USD" });
      if (!methods.isEligible("paypal")) throw new Error("PayPal is not available for this browser");
      session.current = sdk.createPayPalOneTimePaymentSession({
        onApprove: ({ orderId }) => handlers.current.onApproved(orderId),
        onCancel: () => handlers.current.onCancel?.(),
        onError: (e) => handlers.current.onError?.(e.message ?? "PayPal reported an error"),
      });
      if (!cancelled) setState("ready");
    })().catch(() => {
      if (!cancelled) setState("unavailable");
    });
    return () => {
      cancelled = true;
      session.current?.destroy?.();
      session.current = null;
    };
  }, []);

  function start() {
    // Do not await the order before start(): the browser only allows the popup during the click.
    const order = handlers.current.createOrder().then((orderId) => ({ orderId }));
    order.catch(() => undefined);
    session.current?.start({ presentationMode: "auto" }, order).catch((e: unknown) => handlers.current.onError?.(e instanceof Error ? e.message : "PayPal could not open"));
  }

  if (state === "unavailable") {
    return <p className="rounded-2xl border border-flare/30 bg-flare/10 p-4 text-sm text-ink">PayPal could not be loaded here. Check the connection or try another browser.</p>;
  }
  return (
    <div className="relative min-h-12">
      {state === "loading" ? <div className="absolute inset-0 animate-pulse rounded-full bg-white/10" aria-label="Loading PayPal" /> : null}
      <paypal-button type="pay" class="paypal-gold" hidden={state !== "ready"} onClick={start} />
    </div>
  );
}
