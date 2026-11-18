/**
 * Creates .env on first run.
 *
 * AUTH_SECRET signs sessions and encrypts stored platform tokens, so it has to
 * be real randomness rather than a placeholder. Generating it here means a new
 * clone works with one command on any OS - no openssl needed, which matters on
 * Windows where it usually is not installed.
 *
 * Existing .env files are never touched.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (fs.existsSync(envPath)) {
  console.log("  .env already exists - leaving it alone.");
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error("  .env.example is missing; cannot create .env.");
  process.exit(1);
}

const secret = crypto.randomBytes(48).toString("base64");
const contents = fs
  .readFileSync(examplePath, "utf8")
  .replace("change-me-to-a-long-random-string-at-least-32-chars", secret);

fs.writeFileSync(envPath, contents, { mode: 0o600 });
console.log("  Created .env with a freshly generated AUTH_SECRET.");
console.log("  Add ANTHROPIC_API_KEY there later to run the agents on Claude.");
