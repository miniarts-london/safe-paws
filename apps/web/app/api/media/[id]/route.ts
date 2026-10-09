import { fileSize, openRange, readMeta, sessionFrom } from "@/lib/media";

/** Serves an uploaded photo or video to signed-in people, with byte ranges for video seeking. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]">) {
  if (!sessionFrom(req)) return new Response("Sign in to see this.", { status: 401 });
  const { id } = await ctx.params;
  const meta = await readMeta(id);
  if (!meta) return new Response("Not found.", { status: 404 });

  const size = await fileSize(id);
  const headers: Record<string, string> = {
    "Content-Type": meta.type,
    "Accept-Ranges": "bytes",
    // Ids are never reused, so the browser can keep this forever; private because it needs sign-in.
    "Cache-Control": "private, max-age=31536000, immutable",
    // Never let the browser guess a different (executable) type.
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
  };

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    // "bytes=500-" (from 500), "bytes=-500" (last 500), or "bytes=0-999".
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    start = Math.max(0, start);
    return new Response(await openRange(id, start, end), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(await openRange(id, 0, size - 1), { headers: { ...headers, "Content-Length": String(size) } });
}
