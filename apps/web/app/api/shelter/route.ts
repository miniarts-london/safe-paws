import { changeShelter, getUser, loadShelter, ShelterError } from "@safe-paws/db";
import { isStaff } from "@safe-paws/shared/protocol";
import { shelterChangeSchema } from "@safe-paws/shared/shelter";
import { appCors } from "@/lib/appCors";
import { sessionFrom } from "@/lib/media";

/**
 * Shelter layouts. Staff see and change every layout. Everyone else (members, and
 * visitors who aren't signed in) gets only the layouts staff made public, read-only.
 * POST applies one change and returns all the layouts again, so the page always
 * ends up showing what's saved.
 */

const METHODS = "GET, POST";
export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: appCors(req, METHODS) });
}

async function staffId(req: Request) {
  const session = sessionFrom(req);
  const user = session ? await getUser(session.uid) : null;
  return isStaff(user?.role) ? user!.id : null;
}

function fail(err: unknown, headers: Record<string, string>) {
  if (err instanceof ShelterError) return Response.json({ error: err.message }, { status: err.status, headers });
  console.error("shelter failed", err);
  return Response.json({ error: "Couldn't save that. Try again." }, { status: 500, headers });
}

export async function GET(req: Request) {
  const headers = { ...appCors(req, METHODS), "Cache-Control": "no-store" };
  try {
    const staff = await staffId(req);
    return Response.json(await loadShelter({ publicOnly: !staff }), { headers });
  } catch (err) {
    return fail(err, headers);
  }
}

export async function POST(req: Request) {
  const headers = { ...appCors(req, METHODS), "Cache-Control": "no-store" };
  try {
    const userId = await staffId(req);
    if (!userId) throw new ShelterError("Only staff can change the shelter layouts.", 403);
    const parsed = shelterChangeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      // A change this server doesn't know: the page is newer (or older) than the server.
      if (issue?.path[0] === "op") throw new ShelterError("The site has been updated. Reload the page and try again.", 409);
      throw new ShelterError(issue?.message ?? "That change isn't valid.");
    }
    await changeShelter(parsed.data, userId);
    return Response.json(await loadShelter(), { headers });
  } catch (err) {
    return fail(err, headers);
  }
}
