import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@safe-paws/shared/session";

/**
 * The board page's pass for the board server. When the two are on different
 * domains (website on Vercel, board server on Railway), the browser won't send
 * the sign-in cookie to the board server, so the page asks for it here and
 * passes it along itself. Same-origin only: no CORS headers, so other sites
 * can't read the response.
 */
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) return Response.json({ error: "Signed out" }, { status: 401 });
  return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
