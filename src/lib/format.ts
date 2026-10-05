const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function money(amount: number): string {
  return usd.format(amount);
}

/** Short, stable, non-cryptographic hash used only for display in the prototype. The real app signs with SHA-256 + Ed25519. */
export function previewHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function fakePayPalId(prefix: string, seed: string): string {
  return `${prefix}-${previewHash(seed).toUpperCase().slice(0, 12)}`;
}
