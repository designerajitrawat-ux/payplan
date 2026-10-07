// Money is kept as integer cents everywhere in the app. PayPal wants decimal strings.

export type Currency = "USD";

/** 80000 -> "800.00". Refuses fractions of a cent and negative amounts. */
export function centsToValue(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError(`Amount must be a whole, non-negative number of cents, got ${cents}`);
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return `${whole}.${String(rest).padStart(2, "0")}`;
}

/** "800.00" -> 80000. Accepts whole units ("800") too. */
export function valueToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new RangeError(`Not a PayPal amount: ${value}`);
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function amount(cents: number, currency: Currency = "USD") {
  return { currency_code: currency, value: centsToValue(cents) };
}
