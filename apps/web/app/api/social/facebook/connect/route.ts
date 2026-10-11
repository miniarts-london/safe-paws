import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { facebookAuthUrl } from "@/lib/social/facebook";
import { cookieOptions, redirectUri, requestOrigin, requireCoordinator, seal, socialConfig, SocialError, STATE_COOKIE } from "@/lib/social/server";

/** Starts Facebook's own sign-in. A one-off "state" in a cookie makes sure the answer comes back to this coordinator. */
export async function GET(req: Request) {
  const back = new URL("/social", req.url);
  try {
    const uid = await requireCoordinator(req);
    const cfg = socialConfig();
    if (!(cfg.facebook.appId && cfg.facebook.appSecret)) {
      back.searchParams.set("error", "facebook-setup");
      return NextResponse.redirect(back);
    }
    const state = randomBytes(16).toString("hex");
    const res = NextResponse.redirect(facebookAuthUrl(state, redirectUri(requestOrigin(req), "facebook")));
    res.cookies.set(STATE_COOKIE, seal({ state, uid, network: "facebook" }), cookieOptions(600));
    return res;
  } catch (err) {
    if (err instanceof SocialError && err.status === 401) return NextResponse.redirect(new URL("/login?next=%2Fsocial", req.url));
    back.searchParams.set("error", "facebook-token");
    back.searchParams.set("detail", (err as Error).message.slice(0, 300));
    return NextResponse.redirect(back);
  }
}
