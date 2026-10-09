/**
 * Stateless sessions: the cookie holds `payload.signature`, where the
 * signature is an HMAC of the payload with a secret only the servers know.
 * Next.js (login, proxy, pages) and the board WebSocket server both verify
 * it with the same secret, so neither needs a shared session store.
 *
 * Server-side only. Never import this from a client component.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sp_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Session = { uid: string; exp: number };

const DEV_SECRET = "safe-paws-dev-secret-change-me-in-production";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  }
  return DEV_SECRET;
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest();

export function createSessionToken(uid: string, now = Date.now()): { token: string; expires: Date } {
  const exp = now + SESSION_TTL_MS;
  const payload = b64url(Buffer.from(JSON.stringify({ uid, exp } satisfies Session)));
  return { token: `${payload}.${b64url(sign(payload))}`, expires: new Date(exp) };
}

/** Returns the session if the signature is genuine and it hasn't expired; otherwise null. */
export function verifySessionToken(token: string | undefined | null, now = Date.now()): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (typeof session.uid !== "string" || typeof session.exp !== "number" || session.exp <= now) return null;
    return session;
  } catch {
    return null;
  }
}

/** Pulls one cookie out of a raw Cookie header (the WebSocket server has no cookie parser). */
export function readCookie(header: string | undefined, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
