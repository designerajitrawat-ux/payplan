import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The embedded Postgres ships WebAssembly and data files; load it from node_modules as is.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Do not write helper files for coding assistants into the repo.
  agentRules: false,
};

export default nextConfig;
