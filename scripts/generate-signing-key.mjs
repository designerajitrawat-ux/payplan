// Prints a new Ed25519 key for signing acceptance reports, as one line for REPORT_SIGNING_KEY.
// Keep it secret: put it in the hosting provider's environment settings, never in the repo.
import { generateKeyPairSync } from "node:crypto";

const pem = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
console.log(Buffer.from(pem).toString("base64"));
