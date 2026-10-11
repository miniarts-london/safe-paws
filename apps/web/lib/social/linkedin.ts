import { SocialError, socialConfig } from "./server";

/**
 * Posting to a coordinator's own LinkedIn profile, through LinkedIn's official
 * "Share on LinkedIn" product (from linkedin-post-studio). Posting as a company
 * page needs extra approval from LinkedIn, so it isn't offered.
 */
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const REGISTER_UPLOAD_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";
const UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts";
const SCOPES = "openid profile w_member_social";

export const LINKEDIN_MAX = 3000;

async function readError(res: Response) {
  const text = await res.text();
  let raw = text || res.statusText;
  try {
    const json = JSON.parse(text) as { message?: string; error_description?: string; error?: string };
    raw = json.message || json.error_description || json.error || raw;
  } catch {}
  const lower = raw.toLowerCase();
  if (lower.includes("redirect_uri") || lower.includes("redirect uri")) {
    return "LinkedIn rejected the redirect URL. Copy the LinkedIn redirect URL from this page into your LinkedIn app, then connect again.";
  }
  if (lower.includes("access_denied") || lower.includes("not enough permissions") || lower.includes("w_member_social")) {
    return "This LinkedIn app can't post yet. In the LinkedIn developer portal, add the product “Share on LinkedIn”, then disconnect and connect again.";
  }
  return raw;
}

async function check(res: Response) {
  if (!res.ok) throw new SocialError(await readError(res), res.status >= 500 ? 502 : 400);
  return res;
}

export function linkedInAuthUrl(state: string, redirectUri: string) {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: socialConfig().linkedIn.clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  }).toString();
  return url.toString();
}

export async function linkedInSignIn(code: string, redirectUri: string) {
  const { clientId, clientSecret } = socialConfig().linkedIn;
  const token = (await (
    await check(
      await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
      }),
    )
  ).json()) as { access_token: string; expires_in: number };

  const user = (await (await check(await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token.access_token}` } }))).json()) as {
    sub?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
  };
  if (!user.sub) throw new SocialError("LinkedIn didn't say who you are.", 502);
  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    personUrn: user.sub.startsWith("urn:") ? user.sub : `urn:li:person:${user.sub}`,
    name: user.name || [user.given_name, user.family_name].filter(Boolean).join(" ") || "LinkedIn member",
  };
}

export async function publishToLinkedIn(opts: { accessToken: string; personUrn: string; text: string; photo?: { bytes: Buffer; name: string } }) {
  const auth = { Authorization: `Bearer ${opts.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" };
  let media: { status: "READY"; media: string; title: { text: string } }[] | undefined;

  if (opts.photo) {
    const reg = (await (
      await check(
        await fetch(REGISTER_UPLOAD_URL, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: opts.personUrn,
              serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
            },
          }),
        }),
      )
    ).json()) as {
      value?: { asset?: string; uploadMechanism?: { "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: { uploadUrl?: string } } };
    };
    const asset = reg.value?.asset;
    const uploadUrl = reg.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
    if (!asset || !uploadUrl) throw new SocialError("LinkedIn didn't give a place to upload the photo.", 502);
    await check(
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${opts.accessToken}`, "Content-Type": "application/octet-stream" },
        body: new Uint8Array(opts.photo.bytes),
      }),
    );
    media = [{ status: "READY", media: asset, title: { text: opts.photo.name } }];
  }

  const res = await check(
    await fetch(UGC_POSTS_URL, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        author: opts.personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: opts.text },
            shareMediaCategory: media ? "IMAGE" : "NONE",
            ...(media && { media }),
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    }),
  );
  const postId = res.headers.get("x-restli-id") || "";
  return { url: postId ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}` : "https://www.linkedin.com/feed/" };
}
