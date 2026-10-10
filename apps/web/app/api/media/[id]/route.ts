import { isAnimalMedia } from "@safe-paws/db";
import { readMeta, serveMedia, sessionFrom } from "@/lib/media";

/**
 * Serves an uploaded photo or video, with byte ranges for video seeking.
 * Signed-in people can see any upload; visitors only those shown on an
 * animal's profile (not files still sitting in someone's unsaved form).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const meta = await readMeta(id);
  if (!meta) return new Response("Not found.", { status: 404 });
  if (!sessionFrom(req) && !(await isAnimalMedia(id))) return new Response("Sign in to see this.", { status: 401 });
  return serveMedia(req, meta);
}
