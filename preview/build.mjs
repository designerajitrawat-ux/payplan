// Builds a single-file static preview of the prototype (no server needed): preview-dist/payplan.html.
// Run from web/: `npm run preview:build`. Also writes preview-dist/index.html (full document) for local testing.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const out = "preview-dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: ["preview/main.tsx"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    "next/link": "./preview/shims/next-link.tsx",
    "next/navigation": "./preview/shims/next-navigation.ts",
  },
  logOverride: { "module-level-directive": "silent" },
  outfile: `${out}/app.js`,
});

execFileSync("npx", ["@tailwindcss/cli", "-i", "preview/styles.css", "-o", `${out}/app.css`, "--minify"], {
  stdio: "inherit",
});

// Keep inline code from closing its own tag early.
const js = readFileSync(`${out}/app.js`, "utf8").replace(/<\/script/gi, "<\\/script");
const css = readFileSync(`${out}/app.css`, "utf8").replace(/<\/style/gi, "<\\/style");

const fonts =
  "https://fonts.googleapis.com/css2?family=Hubot+Sans:wdth,wght@75..125,400..800&family=Mona+Sans:wdth,wght@75..125,400..700&family=Martian+Mono:wdth,wght@75..112.5,400..600&display=swap";

const body = `<title>PayPlan prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;

writeFileSync(`${out}/payplan.html`, body);
writeFileSync(
  `${out}/index.html`,
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${body}</body>\n</html>\n`,
);

rmSync(`${out}/app.js`);
rmSync(`${out}/app.css`);
console.log(`Preview built: ${out}/payplan.html (${Math.round(body.length / 1024)} KB)`);
