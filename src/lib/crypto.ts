import crypto from "node:crypto";

/**
 * Token encryption for stored platform credentials.
 *
 * Access tokens are secrets: if the database leaks, plaintext tokens would let
 * an attacker post as the user on every connected network. They are encrypted
 * with AES-256-GCM using a key derived from AUTH_SECRET, so the database alone
 * is not enough to use them.
 */

const ALGO = "aes-256-gcm";
let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set it in .env (openssl rand -base64 48).",
    );
  }
  // Fixed info/salt: the secret is already high-entropy, and stable derivation
  // keeps tokens decryptable across restarts.
  cachedKey = Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from("chorus-token-encryption-v1"),
      Buffer.from("social-account-tokens"),
      32,
    ),
  );
  return cachedKey;
}

/** Encrypts a secret. Returns "v1:iv:tag:ciphertext", all base64url. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(":");
}

/** Decrypts a value produced by encryptSecret. Returns null if unreadable. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = crypto.createDecipheriv(
      ALGO,
      key(),
      Buffer.from(parts[1], "base64url"),
    );
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Encrypts a JSON object of per-account config (chat ids, webhook URLs...). */
export function encryptJson(value: unknown): string {
  return encryptSecret(JSON.stringify(value ?? {}));
}

export function decryptJson<T = Record<string, string>>(
  stored: string | null | undefined,
): T | null {
  const raw = decryptSecret(stored);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/** Password hashing with scrypt - no native dependency to build. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("~");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("~");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_MAXMEM,
    });
    if (expected.length !== actual.length) return false;
    // Constant-time compare so timing cannot reveal how much of the hash matched.
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
