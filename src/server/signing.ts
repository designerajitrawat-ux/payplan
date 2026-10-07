// Ed25519 signatures for acceptance reports, so anyone can check that a report is genuine and unchanged.

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Signer = {
  /** Short fingerprint of the public key, stored with every report. */
  keyId: string;
  publicKeyPem: string;
  /** Where the key came from: the environment (deployments) or a local file (local runs). */
  source: "env" | "local-file" | "memory";
  sign(message: string): string;
};

export function keyIdOf(publicKeyPem: string): string {
  return createHash("sha256").update(publicKeyPem.trim()).digest("hex").slice(0, 16);
}

function fromPrivate(key: KeyObject, source: Signer["source"]): Signer {
  const publicKeyPem = createPublicKey(key).export({ type: "spki", format: "pem" }).toString();
  return { keyId: keyIdOf(publicKeyPem), publicKeyPem, source, sign: (message) => sign(null, Buffer.from(message), key).toString("base64") };
}

/** Reads a PEM, or a PEM that was base64-encoded to fit on one line in an environment variable. */
function readPem(value: string): string {
  return value.includes("BEGIN") ? value.replace(/\\n/g, "\n") : Buffer.from(value, "base64").toString("utf8");
}

export function generateSigningKeyPem(): string {
  return generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

export function memorySigner(): Signer {
  return fromPrivate(createPrivateKey(generateSigningKeyPem()), "memory");
}

/**
 * Deployments set REPORT_SIGNING_KEY. Local runs keep a key in .data/ so reports stay verifiable
 * across restarts. A deployment without the key still signs, but its reports stop verifying after
 * a restart, and /api/health says so.
 */
export function signerFromEnv(env: Record<string, string | undefined> = process.env, dataDir = path.join(process.cwd(), ".data")): Signer {
  if (env.REPORT_SIGNING_KEY) return fromPrivate(createPrivateKey(readPem(env.REPORT_SIGNING_KEY)), "env");
  if (env.NODE_ENV !== "production") {
    const file = path.join(dataDir, "report-signing-key.pem");
    if (!existsSync(file)) {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(file, generateSigningKeyPem(), { mode: 0o600 });
    }
    return fromPrivate(createPrivateKey(readFileSync(file, "utf8")), "local-file");
  }
  return memorySigner();
}

export function verifySignature(message: string, signatureBase64: string, publicKeyPem: string): boolean {
  try {
    return verify(null, Buffer.from(message), createPublicKey(publicKeyPem), Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}
