import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@safe-paws/shared/session";

/**
 * Optimistic redirects only: checks the cookie's signature, no database.
 * Pages still verify the session themselves before showing anything.
 */
export function proxy(req: NextRequest) {
  const signedIn = !!verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const path = req.nextUrl.pathname;

  // The Animals pages are public (read-only for visitors); the board needs an account.
  if (path.startsWith("/board") && !signedIn) return NextResponse.redirect(new URL("/login", req.nextUrl));
  if ((path === "/login" || path === "/register") && signedIn) return NextResponse.redirect(new URL("/board", req.nextUrl));
  return NextResponse.next();
}

export const config = { matcher: ["/board/:path*", "/login", "/register"] };
