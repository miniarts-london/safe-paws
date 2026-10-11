import { publishToFacebook } from "@/lib/social/facebook";
import { FACEBOOK_COOKIE, jsonError, photoFrom, readNetwork, requireCoordinator, SocialError } from "@/lib/social/server";

export const maxDuration = 60;

/** Publishes the post (and photo) as the chosen Facebook Page. */
export async function POST(req: Request) {
  try {
    const uid = await requireCoordinator(req);
    const fb = readNetwork(req, FACEBOOK_COOKIE, uid);
    if (!fb) throw new SocialError("Connect Facebook first.", 401);
    const form = await req.formData();
    const text = String(form.get("text") ?? "").trim();
    const pageId = String(form.get("pageId") ?? "").trim();
    if (!pageId) throw new SocialError("Choose a Facebook Page to post as.");
    if (!text) throw new SocialError("Write or generate a post first.");
    if (text.length > 60000) throw new SocialError("This post is too long for Facebook.");
    return Response.json(await publishToFacebook({ accessToken: fb.accessToken, pageId, text, photo: await photoFrom(form) }));
  } catch (err) {
    return jsonError(err);
  }
}
