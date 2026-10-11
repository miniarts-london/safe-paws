import { LINKEDIN_MAX, publishToLinkedIn } from "@/lib/social/linkedin";
import { jsonError, LINKEDIN_COOKIE, photoFrom, readNetwork, requireCoordinator, SocialError } from "@/lib/social/server";

export const maxDuration = 60;

/** Publishes the post (and photo) on the coordinator's LinkedIn profile. */
export async function POST(req: Request) {
  try {
    const uid = await requireCoordinator(req);
    const li = readNetwork(req, LINKEDIN_COOKIE, uid);
    if (!li?.personUrn) throw new SocialError("Connect LinkedIn first.", 401);
    const form = await req.formData();
    const text = String(form.get("text") ?? "").trim();
    if (!text) throw new SocialError("Write or generate a post first.");
    if (text.length > LINKEDIN_MAX) throw new SocialError(`LinkedIn posts can be at most ${LINKEDIN_MAX} characters.`);
    return Response.json(await publishToLinkedIn({ accessToken: li.accessToken, personUrn: li.personUrn, text, photo: await photoFrom(form) }));
  } catch (err) {
    return jsonError(err);
  }
}
