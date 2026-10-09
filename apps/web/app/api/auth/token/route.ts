import { loginSchema } from "@safe-paws/shared/schemas";
import { createSessionToken } from "@safe-paws/shared/session";
import { checkCredentials } from "@/lib/auth/accounts";

/**
 * Sign-in for the mobile app. Same credential check as the web login, but the
 * signed session comes back in the response body instead of a cookie: the app
 * keeps it in the phone's secure storage and sends it as a Bearer token.
 */
/**
 * Native apps don't need CORS. These origins are for the app's web preview
 * (`npm run web -w @safe-paws/mobile`), which runs on Expo's dev server.
 */
const appWebOrigins = new Set(
  (process.env.APP_WEB_ORIGINS ?? "http://localhost:8081").split(",").map((o) => o.trim()),
);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return origin && appWebOrigins.has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : {};
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: { ...cors(req), "Access-Control-Allow-Methods": "POST" } });
}

export async function POST(req: Request) {
  const headers = cors(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send email and password as JSON." }, { status: 400, headers });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter your email and password." }, { status: 400, headers });
  }
  const { email, password } = parsed.data;

  const userId = await checkCredentials(email, password);
  if (!userId) {
    return Response.json({ error: "That email and password don't match. Check them and try again." }, { status: 401, headers });
  }

  const { token, expires } = createSessionToken(userId);
  return Response.json({ token, userId, expiresAt: expires.getTime() }, { headers });
}
