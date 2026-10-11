import { listPages } from "@/lib/social/facebook";
import {
  FACEBOOK_COOKIE,
  jsonError,
  LINKEDIN_COOKIE,
  readNetwork,
  redirectUri,
  requestOrigin,
  requireCoordinator,
  socialConfig,
} from "@/lib/social/server";

/** What the Social post page needs to know: which keys are set, and who's connected. Never the keys themselves. */
export async function GET(req: Request) {
  try {
    const uid = await requireCoordinator(req);
    const cfg = socialConfig();
    const origin = requestOrigin(req);
    const li = readNetwork(req, LINKEDIN_COOKIE, uid);
    const fb = readNetwork(req, FACEBOOK_COOKIE, uid);
    return Response.json({
      claude: !!cfg.anthropic.apiKey,
      linkedIn: {
        configured: !!(cfg.linkedIn.clientId && cfg.linkedIn.clientSecret),
        redirectUri: redirectUri(origin, "linkedin"),
        connectedAs: li?.name ?? null,
      },
      facebook: {
        configured: !!(cfg.facebook.appId && cfg.facebook.appSecret),
        redirectUri: redirectUri(origin, "facebook"),
        connectedAs: fb?.name ?? null,
        pages: fb ? await listPages(fb.accessToken).catch(() => []) : [],
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
