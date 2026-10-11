import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { linkedInAuthUrl } from "@/lib/social/linkedin";
import { cookieOptions, redirectUri, requestOrigin, requireCoordinator, seal, socialConfig, SocialError, STATE_COOKIE } from "@/lib/social/server";

/** Starts LinkedIn's own sign-in. A one-off "state" in a cookie makes sure the answer comes back to this coordinator. */
export async function GET(req: Request) {
  const back = new URL("/social", req.url);
  try {
    const uid = await requireCoordinator(req);
    const cfg = socialConfig();
    if (!(cfg.linkedIn.clientId && cfg.linkedIn.clientSecret)) {
      back.searchParams.set("error", "linkedin-setup");
      return NextResponse.redirect(back);
    }
    const state = randomBytes(16).toString("hex");
    const res = NextResponse.redirect(linkedInAuthUrl(state, redirectUri(requestOrigin(req), "linkedin")));
    res.cookies.set(STATE_COOKIE, seal({ state, uid, network: "linkedin" }), cookieOptions(600));
    return res;
  } catch (err) {
    if (err instanceof SocialError && err.status === 401) return NextResponse.redirect(new URL("/login?next=%2Fsocial", req.url));
    back.searchParams.set("error", "linkedin-token");
    back.searchParams.set("detail", (err as Error).message.slice(0, 300));
    return NextResponse.redirect(back);
  }
}
