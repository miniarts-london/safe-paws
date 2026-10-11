import { SocialError, socialConfig } from "./server";

/**
 * Posting as a Facebook Page the coordinator manages, through the official
 * Graph API (from linkedin-post-studio). Facebook doesn't let apps post to a
 * personal profile.
 */
const GRAPH_VERSION = "v22.0";
const DIALOG_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const SCOPES = "public_profile,pages_show_list,pages_manage_posts,pages_read_engagement";

export type FacebookPage = { id: string; name: string };

async function check(res: Response) {
  if (res.ok) return res;
  const text = await res.text();
  let message = text || res.statusText;
  try {
    const json = JSON.parse(text) as { error?: { message?: string; error_user_msg?: string }; error_description?: string };
    message = json.error?.error_user_msg || json.error?.message || json.error_description || message;
  } catch {}
  throw new SocialError(message, res.status >= 500 ? 502 : 400);
}

const graphGet = async <T>(path: string, token: string) => {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  return (await (await check(await fetch(url))).json()) as T;
};

export function facebookAuthUrl(state: string, redirectUri: string) {
  const url = new URL(DIALOG_URL);
  url.search = new URLSearchParams({
    client_id: socialConfig().facebook.appId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
    response_type: "code",
  }).toString();
  return url.toString();
}

export async function facebookSignIn(code: string, redirectUri: string) {
  const { appId, appSecret } = socialConfig().facebook;
  const short = new URL(TOKEN_URL);
  short.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString();
  const first = (await (await check(await fetch(short))).json()) as { access_token: string; expires_in?: number };

  // Swap for a long-lived token (about 60 days) so coordinators don't reconnect every hour.
  let accessToken = first.access_token;
  let expiresIn = first.expires_in ?? 3600;
  const long = new URL(TOKEN_URL);
  long.search = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: accessToken }).toString();
  const res = await fetch(long);
  if (res.ok) {
    const json = (await res.json()) as { access_token: string; expires_in?: number };
    accessToken = json.access_token;
    expiresIn = json.expires_in ?? 60 * 24 * 3600;
  }
  const me = await graphGet<{ id: string; name?: string }>("/me?fields=id,name", accessToken);
  return { accessToken, expiresAt: Date.now() + expiresIn * 1000, name: me.name || "Facebook user" };
}

async function pageAccounts(token: string) {
  const json = await graphGet<{ data?: { id: string; name: string; access_token: string; tasks?: string[] }[] }>(
    "/me/accounts?fields=id,name,access_token,tasks",
    token,
  );
  return (json.data ?? []).filter((p) => !p.tasks?.length || p.tasks.includes("CREATE_CONTENT") || p.tasks.includes("MANAGE"));
}

export async function listPages(token: string): Promise<FacebookPage[]> {
  return (await pageAccounts(token)).map(({ id, name }) => ({ id, name }));
}

export async function publishToFacebook(opts: { accessToken: string; pageId: string; text: string; photo?: { bytes: Buffer; name: string } }) {
  const page = (await pageAccounts(opts.accessToken)).find((p) => p.id === opts.pageId);
  if (!page) throw new SocialError("That Facebook Page isn't available on this account.", 403);
  const auth = { Authorization: `Bearer ${page.access_token}` };

  let postId = "";
  if (opts.photo) {
    const form = new FormData();
    form.set("message", opts.text);
    form.set("published", "true");
    form.set("source", new File([new Uint8Array(opts.photo.bytes)], opts.photo.name, { type: "image/jpeg" }));
    const json = (await (await check(await fetch(`${GRAPH}/${page.id}/photos`, { method: "POST", headers: auth, body: form }))).json()) as {
      id?: string;
      post_id?: string;
    };
    postId = json.post_id || json.id || "";
  } else {
    const json = (await (
      await check(
        await fetch(`${GRAPH}/${page.id}/feed`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ message: opts.text, published: "true" }),
        }),
      )
    ).json()) as { id?: string };
    postId = json.id || "";
  }

  let url = `https://www.facebook.com/${page.id}`;
  if (postId) {
    try {
      url = (await graphGet<{ permalink_url?: string }>(`/${postId}?fields=permalink_url`, page.access_token)).permalink_url || url;
    } catch {}
  }
  return { url, pageName: page.name };
}
