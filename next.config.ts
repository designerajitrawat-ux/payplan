import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The embedded Postgres ships WebAssembly and data files; load it from node_modules as is.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Do not write helper files for coding assistants into the repo.
  agentRules: false,
  // PayPal's checkout opens in a popup that must be able to talk back to this page.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }] }];
  },
};

export default nextConfig;
