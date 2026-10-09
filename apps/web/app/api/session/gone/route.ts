import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@safe-paws/shared/session";

/**
 * The cookie is genuine but the account no longer exists. Clear it before
 * going to /login, or the proxy would send a "signed-in" visitor straight back.
 */
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.nextUrl));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
