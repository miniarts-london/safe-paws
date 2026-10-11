import { cookieOptions, jsonError, LINKEDIN_COOKIE, requireCoordinator } from "@/lib/social/server";

/** Disconnect LinkedIn on this browser. */
export async function DELETE(req: Request) {
  try {
    await requireCoordinator(req);
    const res = Response.json({ ok: true });
    res.headers.append("Set-Cookie", `${LINKEDIN_COOKIE}=; Path=${cookieOptions(0).path}; Max-Age=0; HttpOnly; SameSite=Lax`);
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
