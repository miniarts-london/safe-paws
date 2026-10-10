import { readMeta, serveMedia, sessionFrom } from "@/lib/media";

/** Serves an uploaded photo or video to signed-in people, with byte ranges for video seeking. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]">) {
  if (!sessionFrom(req)) return new Response("Sign in to see this.", { status: 401 });
  const { id } = await ctx.params;
  const meta = await readMeta(id);
  if (!meta) return new Response("Not found.", { status: 404 });
  return serveMedia(req, meta);
}
