import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getUser } from "@safe-paws/db";
import { sessionFrom } from "@/lib/media";

/**
 * Shared server pieces for the coordinators' Social post page: who may use
 * it, which keys are set, and the encrypted cookies that hold the LinkedIn
 * and Facebook sign-ins.
 *
 * Keys come from environment variables (set them in Vercel, or .env locally):
 *   ANTHROPIC_API_KEY, ANTHROPIC_MODEL (optional),
 *   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET,
 *   FACEBOOK_APP_ID, FACEBOOK_APP_SECRET.
 */

export class SocialError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Only coordinators. Returns their user id. */
export async function requireCoordinator(req: Request) {
  const session = sessionFrom(req);
  if (!session) throw new SocialError("Sign in first.", 401);
  const user = await getUser(session.uid);
  if (user?.role !== "coordinator") throw new SocialError("Only coordinators can use the social posts page.", 403);
  return session.uid;
}

const env = (name: string) => process.env[name]?.trim() || "";

export function socialConfig() {
  return {
    anthropic: { apiKey: env("ANTHROPIC_API_KEY"), model: env("ANTHROPIC_MODEL") || "claude-sonnet-5-5" },
    linkedIn: { clientId: env("LINKEDIN_CLIENT_ID"), clientSecret: env("LINKEDIN_CLIENT_SECRET") },
    facebook: { appId: env("FACEBOOK_APP_ID"), appSecret: env("FACEBOOK_APP_SECRET") },
  };
}

/** This site's address as the browser sees it (Vercel puts it in forwarded headers). */
export function requestOrigin(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const local = host.startsWith("localhost") || host.startsWith("127.");
  const proto = req.headers.get("x-forwarded-proto") || (local ? "http" : url.protocol.replace(":", "") || "https");
  return `${proto}://${host}`;
}

export const redirectUri = (origin: string, network: "linkedin" | "facebook") => `${origin}/api/social/${network}/callback`;

/* ---------- encrypted cookies for the networks' sign-ins ---------- */

export const LINKEDIN_COOKIE = "sp_social_li";
export const FACEBOOK_COOKIE = "sp_social_fb";
export const STATE_COOKIE = "sp_social_state";

function key() {
  // Same rule as the sign-in cookie: required in production, a fixed stand-in in development.
  const secret = env("SESSION_SECRET") || (process.env.NODE_ENV === "production" ? "" : "safe-paws-development-only");
  if (!secret) throw new SocialError("SESSION_SECRET isn't set.", 500);
  return createHash("sha256").update(`social:${secret}`).digest();
}

/** AES-GCM: the access token can't be read or changed by anyone holding the cookie. */
export function seal(value: object) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal<T>(sealed: string | undefined): T | null {
  if (!sealed) return null;
  try {
    const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name: string) {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/social",
  maxAge,
});

export type NetworkSession = { uid: string; accessToken: string; name: string; expiresAt: number; personUrn?: string };

/** A network sign-in, only if it belongs to this coordinator and hasn't expired. */
export function readNetwork(req: Request, cookie: string, uid: string) {
  const s = unseal<NetworkSession>(readCookie(req, cookie));
  return s && s.uid === uid && s.expiresAt > Date.now() ? s : null;
}

export function jsonError(err: unknown) {
  if (err instanceof SocialError) return Response.json({ error: err.message }, { status: err.status });
  console.error("[social]", err);
  return Response.json({ error: (err as Error).message || "Something went wrong." }, { status: 500 });
}

/** A photo sent from the page: always a resized JPEG (the page converts it), so small and safe to pass on. */
export async function photoFrom(form: FormData) {
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.type !== "image/jpeg") throw new SocialError("The photo should be a JPEG.");
  if (file.size > 4 * 1024 * 1024) throw new SocialError("That photo is too large. Try a smaller one.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) throw new SocialError("That doesn't look like a real photo.");
  return { bytes, name: file.name || "photo.jpg" };
}
