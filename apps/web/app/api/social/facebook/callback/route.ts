import { NextResponse } from "next/server";
import { facebookSignIn } from "@/lib/social/facebook";
import {
  cookieOptions,
  FACEBOOK_COOKIE,
  readCookie,
  redirectUri,
  requestOrigin,
  requireCoordinator,
  seal,
  SocialError,
  STATE_COOKIE,
  unseal,
} from "@/lib/social/server";

/** Facebook sends the coordinator back here after they approve. Keeps the sign-in in an encrypted cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = new URL("/social", req.url);
  const fail = (code: string, detail?: string) => {
    back.searchParams.set("error", code);
    if (detail) back.searchParams.set("detail", detail.slice(0, 300));
    const res = NextResponse.redirect(back);
    res.cookies.set(STATE_COOKIE, "", cookieOptions(0));
    return res;
  };
  try {
    const uid = await requireCoordinator(req);
    const expected = unseal<{ state: string; uid: string; network: string }>(readCookie(req, STATE_COOKIE));
    if (url.searchParams.get("error")) return fail("facebook-denied");
    const code = url.searchParams.get("code");
    if (!code || !expected || expected.network !== "facebook" || expected.uid !== uid || expected.state !== url.searchParams.get("state")) {
      return fail("facebook-state");
    }
    const signedIn = await facebookSignIn(code, redirectUri(requestOrigin(req), "facebook"));
    back.searchParams.set("connected", "facebook");
    const res = NextResponse.redirect(back);
    res.cookies.set(STATE_COOKIE, "", cookieOptions(0));
    res.cookies.set(FACEBOOK_COOKIE, seal({ uid, ...signedIn }), cookieOptions(Math.max(60, Math.floor((signedIn.expiresAt - Date.now()) / 1000))));
    return res;
  } catch (err) {
    return fail("facebook-token", err instanceof SocialError ? err.message : "Couldn't connect Facebook.");
  }
}
