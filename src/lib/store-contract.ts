// Compile-time check that the prototype store and the API store offer the same hooks and actions,
// so every screen works with either one.
type Local = typeof import("./store-local");
type Remote = Omit<typeof import("./store-remote"), "ApiError">;
type Mismatch = { [K in keyof Remote]: K extends keyof Local ? (Local[K] extends Remote[K] ? never : K) : K }[keyof Remote];

export const storeContract: [Mismatch] extends [never] ? true : Mismatch = true;
