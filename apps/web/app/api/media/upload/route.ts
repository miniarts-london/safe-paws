import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { BLOB_PATH, checkFile, requireUploader, usingBlob } from "@/lib/media";

/** Tells the form how to upload: straight to Blob (on Vercel), or through this server. */
export function GET() {
  return Response.json({ direct: usingBlob() });
}

/**
 * Hands the browser a short-lived token to upload one file straight to the
 * private Blob store. Only staff get one, only for an allowed type and size,
 * and only for a fresh `media/<uuid>` path (no overwriting). Once the upload
 * finishes, the browser calls ../register, which checks the file itself.
 */
export async function POST(req: Request) {
  if (!usingBlob()) return Response.json({ error: "Direct uploads aren't set up here." }, { status: 404 });
  try {
    const body = (await req.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        await requireUploader(req);
        if (!BLOB_PATH.test(pathname)) throw new Error("That upload path isn't allowed.");
        const { type, size } = JSON.parse(clientPayload ?? "{}") as { type?: string; size?: number };
        const { max } = checkFile(String(type), Number(size));
        return { allowedContentTypes: [String(type)], maximumSizeInBytes: max, addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return Response.json(json);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
